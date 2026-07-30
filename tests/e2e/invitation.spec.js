import { test, expect } from '@playwright/test';

const apiPattern = /script\.google\.com|script\.googleusercontent\.com/;

async function guardRsvpApi(page, getHandler = route => route.fulfill({ json: [] })) {
  await page.route(apiPattern, async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, body: 'ok' });
      return;
    }
    await getHandler(route);
  });
}

async function openEnvelope(page) {
  const seal = await page.locator('#seal').boundingBox();
  await page.mouse.click(seal.x + seal.width / 2, seal.y + seal.height / 2);
  await expect(page.locator('#letterScene')).toBeVisible();
}

async function openInvitation(page) {
  await openEnvelope(page);
  const letter = await page.locator('#letterPaperFrame').boundingBox();
  await page.mouse.click(letter.x + letter.width / 2, letter.y + letter.height / 2);
  await expect(page.locator('#invite')).toHaveClass(/show/);
}

test.beforeEach(async ({ page }) => {
  await guardRsvpApi(page);
});

test('wax seal center tap opens the envelope at 375x812', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  await openEnvelope(page);
});

test('completed letter layout reconciles across desktop breakpoint resize', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await openInvitation(page);
  await expect(page.locator('#letterScene')).toHaveClass(/desktop-morph/);
  await expect(page.locator('#invite')).toHaveClass(/desktop-invite/);

  await page.setViewportSize({ width: 768, height: 1024 });

  await expect(page.locator('#letterScene')).toBeHidden();
  await expect(page.locator('#invite')).not.toHaveClass(/desktop-invite/);
  await expect(page.locator('#invite')).toBeVisible();
  await expect(page.locator('#inviteHeading')).toBeVisible();
});

test('failed first wishes load retries on the next open', async ({ page }) => {
  let gets = 0;
  await page.unroute(apiPattern);
  await guardRsvpApi(page, route => {
    gets += 1;
    return gets === 1
      ? route.fulfill({ status: 500, body: 'error' })
      : route.fulfill({ json: [{ name: 'Retry Guest', message: 'Loaded on retry', submittedAt: '2026-07-30T00:00:00Z' }] });
  });
  await page.goto('/');
  await expect.poll(() => gets).toBe(0);

  await page.evaluate(() => window.openMessages());
  await expect(page.locator('#messagesPanel')).toContainText('Gagal memuat ucapan.');
  await page.evaluate(() => window.toggleMessages());
  await page.evaluate(() => window.toggleMessages());

  await expect.poll(() => gets).toBe(2);
  await expect(page.locator('#messagesPanel')).toContainText('Loaded on retry');
});

test('Enter and Space traverse envelope and letter', async ({ page }) => {
  await page.goto('/');
  const envelope = page.locator('#envelope');
  await envelope.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#letterScene')).toBeVisible();

  const letter = page.locator('#letterPaperFrame');
  await letter.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#invite')).toHaveClass(/show/);
});

test('successful RSVP appends wish with one POST and no GET', async ({ page }) => {
  let posts = 0;
  let gets = 0;
  await page.unroute(apiPattern);
  await guardRsvpApi(page, route => {
    gets += 1;
    return route.fulfill({ json: [] });
  });
  page.on('request', request => {
    if (apiPattern.test(request.url()) && request.method() === 'POST') posts += 1;
  });
  await page.goto('/');
  await page.evaluate(() => {
    document.getElementById('invite').classList.add('show');
    document.getElementById('envelopeScene').classList.add('hidden');
    document.getElementById('letterScene').classList.add('hidden');
    document.body.classList.remove('envelope-locked');
  });
  await page.locator('#rsvpName').fill('E2E Guest');
  await page.locator('#rsvpMsg').fill('A safe intercepted wish');
  await page.locator('#rsvpSubmit').click();

  await expect(page.locator('#messagesPanel')).toContainText('A safe intercepted wish');
  expect(posts).toBe(1);
  expect(gets).toBe(0);
});

test('closed wishes panel cannot intercept taps', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('#messagesPanel');

  await expect(panel).toHaveCSS('visibility', 'hidden');
  await expect(panel).toHaveCSS('pointer-events', 'none');
  await page.evaluate(() => window.openMessages());
  await expect(panel).toHaveCSS('visibility', 'visible');
  await expect(panel).toHaveCSS('pointer-events', 'auto');
});
