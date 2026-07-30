# E2E Test Report — Wedding Invitation (Sultana & Fahmi)

**Date:** 2026-07-30
**Build under test:** `main` @ `f0bbc0d` (working tree clean, `git diff --check` clean)
**Environment:** Vite dev server `http://localhost:4173`, Chromium (in-app browser), DPR 2
**Viewports exercised:** 375×812 (mobile), 768×1024 (tablet portrait), 1024×768 (tablet landscape), 1280×800 (desktop)
**Production build:** `npm run build` — succeeded in 206 ms, no warnings

### Safety note on test method
`RSVP_API_URL` points at the couple's **live** Google Sheet. To avoid writing junk rows into
production data, all RSVP `POST` requests were intercepted with a stubbed `window.fetch` that
returned synthetic `200` / `500` responses. **No test rows were written to the real sheet.**
`GET` (reading wishes) was exercised against the real endpoint, since it is read-only.

---

## 1. Summary

| | Count |
|---|---|
| Test cases executed | 41 |
| Passed | 28 |
| Failed / defective | 13 |
| Blocker (P0) | 2 |
| High (P1) | 8 |
| Medium (P2) | 12 |
| Low (P3) | 7 |

**Verdict: not ready to send to guests.** The core interaction paths are all correct — the
personalisation, RSVP write/read, countdown, calendar and map links, and XSS handling all behave
properly. But two defects make the invitation *unusable* for a share of guests: a transparent
overlay swallows a quarter of the envelope's tap area (including the wax seal, the most obvious
place to tap), and rotating a tablet after opening the letter traps the guest on the letter screen
with no way forward. Both are small, localised fixes.

---

## 2. Functional test results

### 2.1 Entry flow — envelope → letter → invitation

| # | Test | Result |
|---|---|---|
| F1 | Envelope scene renders, typewriter sequence plays in order (heading → "Kepada Yth." → guest → hint) | **Pass** |
| F2 | Tap envelope (outside overlay region) opens flap, starts music, swaps to letter after 1.9 s | **Pass** |
| F3 | Tap letter advances to invitation, unlocks body scroll, starts scroll-reveal | **Pass** |
| F4 | Tap envelope **at its centre / wax seal** | **FAIL — D1 (P0)** |
| F5 | Re-tapping an already-open envelope is a no-op (guard works) | **Pass** |
| F6 | Re-tapping the letter after completion is a no-op (`dataset.completed`) | **Pass** |
| F7 | Open letter at ≥1000 px, then narrow below 1000 px | **FAIL — D2 (P0)** |
| F8 | Envelope / letter reachable by keyboard | **FAIL — D10 (P1)** |

### 2.2 Personalisation (`?to=`)

| # | Test | Result |
|---|---|---|
| F9 | `?to=Budi-Santoso` → "Budi Santoso" on envelope, "Dear Budi Santoso," in letter, pre-filled RSVP name | **Pass** |
| F10 | No `?to=` → "Tamu Undangan" / "Dear Guests," | **Pass** |
| F11 | Pre-filled name is `readOnly` + `aria-readonly` | **Pass** (but see D18) |
| F12 | Long name (46 chars) — envelope address, letter greeting, desktop layout | **Pass**, no overflow |

### 2.3 RSVP form

| # | Test | Result |
|---|---|---|
| F13 | Empty name → "Mohon isi nama Anda.", form retained | **Pass** |
| F14 | Whitespace-only name → same rejection | **Pass** |
| F15 | Successful submit → form replaced by success message with `role="status"` | **Pass** |
| F16 | Correct copy for attending vs. not attending | **Pass** |
| F17 | Failed submit (500) → error copy, button re-enabled, label restored to "Kirim Konfirmasi" | **Pass** |
| F18 | Double-submit blocked while in flight (`submitBtn.disabled`) | **Pass** |
| F19 | "Tidak Hadir" hides guest count and sends `guests: 0` | **Pass** |
| F20 | Payload shape: `{name, attending, guests, message, submittedAt}` | **Pass** |
| F21 | Message > 1000 chars / name > 120 chars | **FAIL — D17 (P2)**, silently truncated server-side |
| F22 | Repeat submission after page reload | **FAIL — D6 (P1)**, duplicates accepted |

### 2.4 Wishes panel

| # | Test | Result |
|---|---|---|
| F23 | Wishes load from Apps Script, filtered to non-empty messages, newest first | **Pass** |
| F24 | XSS: message `Selamat ya! <img src=x onerror="alert(1)"> & "quotes"` | **Pass** — escaped in *both* render paths, no element injected |
| F25 | Submitted wish appended optimistically without reload | **Pass** |
| F26 | Panel toggles open/closed | **Pass** |
| F27 | Recovery after a failed load | **FAIL — D3 (P1)**, permanently stuck |
| F28 | Panel does not obscure page content | **FAIL — D16 (P2)** |

### 2.5 Content & integrations

| # | Test | Result |
|---|---|---|
| F29 | Countdown vs. 2026-08-23 08:00 WIB — UI `23d 17h 18m 44s`, computed `23` days | **Pass** |
| F30 | Countdown ticks each second, animates on change | **Pass** |
| F31 | Google Calendar link → `20260823T010000Z/20260823T060000Z` = 08:00–13:00 WIB | **Pass** — matches the printed schedule |
| F32 | Map link `maps.google.com/?q=Akasia+Resto+%26+Lounge+Dieng+Atas+Malang`, `rel="noopener"` | **Pass** |
| F33 | Event card: Akad 08.00–09.00, Resepsi 10.00–13.00, venue, address | **Pass** |
| F34 | Mini calendar — August 2026, 23rd highlighted, 1 Aug on Saturday | **Pass** |
| F35 | Arabic verse + translation + citation render | **Pass** (but see D13) |
| F36 | Music starts on envelope open, mute toggle works, offset preserved | **Pass** |
| F37 | Music pauses on tab hide and resumes on return; stops on `pagehide` | **Pass** |
| F38 | Console clean through the whole flow (only Vite HMR debug lines) | **Pass** |
| F39 | `addToCalendar()` ICS export | **FAIL — D22 (P3)**, dead code, never wired to any control |

### 2.6 Responsive

| # | Test | Result |
|---|---|---|
| F40 | Desktop 1280×800 — split layout, persistent letter left, scrolling invitation right | **Pass**, but see D24 |
| F41 | Mobile 375×812 — single column, scroll-snap, tap-to-advance | **Pass** |

---

## 3. Defects

### D1 — P0 — Invisible wish bubbles swallow taps over a quarter of the envelope

**The single most important bug.** `.msg-bubble` sets `pointer-events: auto`
([index.html:1661](index.html#L1661)) while the *closed* panel hides its children with `opacity: 0`
only. The panel itself is `position: fixed; bottom: 88px; left: 18px; z-index: 998`
([index.html:1633](index.html#L1633)) — directly on top of the envelope on a phone.

Measured on 375×812 with the 20 wishes currently in the sheet:

- Panel occupies `x 18–298, y 364–724` = **33 % of the viewport**, all of it invisible and all of it clickable.
- Hit-testing the envelope rect `(21, 297, 332, 222)` on an 8 px grid: **25 % of the envelope's
  tap area does not reach the envelope**, concentrated in rows y 394–514 — i.e. the wax seal and
  the "Kepada Yth. / \<name\>" address.
- Reproduced live: two real clicks at the envelope centre produced **no state change at all**
  (`envelope.classList.contains('open') === false`). A click at (280, 330), just above the panel,
  opened it immediately.
- `document.elementFromPoint(187, 405)` → `div.msg-bubble`.

Guests who tap the seal — the natural target — get silence. The dead zone **grows as more wishes
arrive**, up to the panel's `max-height: min(360px, 60vh)`. Same overlay also covers part of the
letter's tap target, and part of the invitation's tap-to-advance area, where taps land on bubbles
that are outside `#invite` and so never reach its `pointerup` handler.

**Fix:** move `pointer-events: auto` from `.msg-bubble` onto `.messages-panel.open .msg-bubble`,
and add `visibility: hidden` (or `display: none`) to the closed panel so it cannot receive hits at all.

---

### D2 — P0 — Narrowing below 1000 px after opening the letter traps the guest permanently

`openLetter()` picks the desktop/mobile branch once, at click time, and only removes the letter
scene in the mobile branch — `if(!desktop) letterScene.classList.add('hidden')`
([index.html:2049](index.html#L2049)). There is no `resize` or `matchMedia` listener, so the choice
is never revisited.

Reproduced: opened the letter at 1024×768, then resized to 768×1024 (a tablet rotated to portrait,
or a desktop window narrowed / put into split screen). Result:

- `#letterScene` keeps `desktop-morph` and no `hidden`, `position: fixed; inset: 0; z-index: 20`,
  `pointer-events: auto`, filling the full **768 × 1024** viewport.
- Every hit test lands on the letter overlay: `(384,300)`, `(384,512)`, `(384,800)`, `(100,512)`
  all `[BLOCKED by overlay]` — the invitation underneath is unreachable.
- The letter still shows "TAP TO OPEN", but tapping is a no-op because `openLetter()` early-returns
  on `dataset.completed === 'true'`.

The guest is stranded on a screen whose only visible instruction no longer does anything. Only a
full reload recovers — and then they have to redo the envelope.

**Fix:** re-evaluate the breakpoint on `resize` / `matchMedia('(min-width:1000px)').onchange` and
normalise the letter scene's classes; or clear `desktop-morph` and add `hidden` whenever the
viewport drops below 1000 px after completion.

---

### D3 — P1 — Wishes panel is permanently stuck on "Gagal memuat ucapan." after one failed load

`loadMessages()` sets `messagesLoaded = true` **before** awaiting the fetch
([index.html:2337](index.html#L2337)) and never resets it in the `catch`. `toggleMessages()` calls
`openMessages(false)` → `loadMessages(false)`, which short-circuits on `messagesLoaded`.

Reproduced: cold load with the endpoint failing → panel shows "Gagal memuat ucapan.". Network then
restored, and the guest taps the wishes button three times → still "Gagal memuat ucapan.", with
**zero** further network attempts. Only a page reload recovers.

This is the likely-failure case, not an exotic one: the invitation will mostly be opened from
WhatsApp on mobile data.

**Fix:** set `messagesLoaded = true` only on success, or set `messagesLoaded = false` in the `catch`,
and add a "Coba lagi" affordance to the error state.

---

### D4 — P1 — The wishes request fires on page load, on the envelope screen, and cost 3.1 s

`loadMessages()` is called unconditionally at the bottom of the script
([index.html:2373](index.html#L2373)). Resource timing from a real load:

```
https://script.google.com/macros/s/…/exec   start 128 ms   duration 3093 ms
```

Three seconds of third-party latency spent before the guest has opened anything, for a panel most
guests will never open — and, combined with D3, it burns the one and only load attempt while the
guest is still looking at a sealed envelope.

**Fix:** load wishes lazily on first open of the panel (and after a successful RSVP), not at page load.

---

### D5 — P1 — The RSVP endpoint publicly exposes every guest's response

`doGet()` in [apps-script/Code.gs](apps-script/Code.gs) returns the **entire sheet** — name,
attending, party size, message, timestamp — to any unauthenticated caller. The deployment URL is
in the page source, so anyone with the invitation link has it.

Verified: I read all 20 rows, including names and messages, with a plain `GET` and no credentials.

`doPost()` likewise accepts unauthenticated writes with no rate limiting, no origin check, and no
CAPTCHA — anyone can inject arbitrary rows that are then displayed to every guest.

**Fix (minimum):** have `doGet` return only `{name, message}` for rows the couple has marked
approved; add a shared secret or a simple token to `doPost`; consider a per-IP or per-minute cap.

---

### D6 — P1 — The live wishes feed is unmoderated and currently full of test rows and political slogans

The 20 rows now in production and shown to every guest include:

- `testing1` ×3, `testing3`, `hidup jokowi` ×4 — leftover developer tests
- Political statements: `gulingkan rezim`, `tangkap prabowo, hentikan mbg, rubuhkan kopdes`,
  `adili jokowi`, `naikkan gaji hakim2 kita` ×3, `naikkan gaji guru`
- Joke entries under the couple's own names (`sul`, `ana`, `sultana`, `fahmi`, `Fahmi dan Sultana`)
- **Exact duplicates** — three identical `testing1 / hidup jokowi` rows and two identical
  `Sultana Balqis Hidayat / naikkan gaji hakim2 kita` rows

Two problems: this is what guests see today, and there is no moderation mechanism at all. Note the
README claims wishes are "approved-by-presence" — **there is no approval step in the code**; every
row with a non-empty message is published immediately.

Duplicates also confirm there is no dedupe. `doPost` computes `nextNo = sheet.getLastRow()` with no
`LockService`, so two simultaneous submissions can collide on the `No` column or lose a row.

**Fix:** clear the test rows before sending invitations; add an `Approved` column that `doGet`
filters on; wrap `doPost` in `LockService.getScriptLock()`.

---

### D7 — P1 — ~6 MB of assets, all eagerly loaded; the HTML document alone is 566 KB gzipped

| Asset | Size |
|---|---|
| `index.html` (build output) | **788 KB** → 566 KB gzip |
| ↳ inline base64 in CSS (`--bg-main`, one background) | ~450 KB of that |
| ↳ inline base64 `<img>` (wax seal, gift icon) | ~272 KB of that |
| `main-background-mobile.png` | **2.6 MB** |
| `bg-song.mp3` | 2.0 MB |
| `letter-paper.jpg` | 409 KB |
| `main-background-desktop.avif` | 246 KB |
| `envelope-flower.png` | 242 KB |
| `d1ee4cf058b326a3bc3dd10580823076.jpg` | 164 KB |
| `favicon.png` | 37 KB |

Resource timing shows **every** image requested within ~35 ms of each other at load — the desktop
background, the mobile background, the letter paper and the flowers are all fetched up front,
regardless of viewport. On a mid-range Indonesian mobile connection this is a multi-second wait for
a wedding invitation.

Also: the ~722 KB of base64 is embedded in the HTML, so it can never be cached separately and it
is re-downloaded on every visit; and Google Fonts are pulled with `@import` **inside** `<style>`
([index.html:9](index.html#L9)), which serialises the request chain instead of starting it in parallel.

**Fix:** extract the two base64 `<img>`s and `--bg-main` to files in `public/`; re-encode
`main-background-mobile.png` as WebP/AVIF (a 2.6 MB PNG for a painterly background should be
80–150 KB); serve desktop/mobile backgrounds behind media queries so only one loads; replace the
`@import` with `<link rel="preconnect">` + `<link rel="stylesheet">`.

---

### D8 — P1 — Music holds 47.6 MB of decoded PCM and cannot start until the full 2 MB has downloaded

`loadMusic()` fetches the whole MP3 and calls `decodeAudioData`, which expands it into an
uncompressed buffer. Measured on the live page:

```
musicBuffer: 130 s, 2 ch, 48 000 Hz  →  47.6 MB resident
```

On a low-RAM Android phone that is a real risk of the tab being killed, and the guest hears nothing
until all 2 MB has arrived (tens of seconds on 3G).

**Fix:** use a plain `<audio src="/bg-song.mp3" loop>` element, which streams and starts almost
immediately, and keep the Web Audio path only if a specific effect needs it.

---

### D9 — P1 — `CNAME` is missing from the deployed artifact; `.DS_Store` is published

`CNAME` (`momentofsultanafahmi.my.id`) lives in the **repository root**. Vite only copies `public/`
into `dist/`, so it is absent from the build:

```
dist/  →  index.html, assets/, bg-song.mp3, envelope-background-*, envelope-flower.png,
          favicon.png, letter-paper.jpg, main-background-*.{png,avif}, .DS_Store
```

No `CNAME`. The Pages workflow uploads `dist/` as the artifact
([.github/workflows/pages.yml](.github/workflows/pages.yml)), so the custom-domain file never
reaches the deployment — the domain currently survives only on the repo's Pages setting, with
nothing in the repo to keep it that way.

Separately, `public/.DS_Store` (6 KB of macOS Finder metadata) **is** copied into `dist/` and
published. `.gitignore` covers `.DS_Store` for Git but not for the build.

**Fix:** `git mv CNAME public/CNAME`; delete `public/.DS_Store` and `dist/.DS_Store`.

---

### D10 — P1 — Keyboard and screen-reader users cannot get past the envelope

Both gates are plain `<div onclick>` with no `tabindex`, no `role`, and no key handler:

- `<div class="envelope" id="envelope" onclick="openEnvelope()">` — [index.html:1729](index.html#L1729)
- `<div class="letter-paper-frame" onclick="openLetter()">` — [index.html:1757](index.html#L1757)

Enumerating focusable elements on the envelope screen returns 10 items — and **neither gate is
among them**. The whole invitation is behind a control no keyboard user can reach.

Worse, the reverse is also true: while the invitation is still hidden, its controls
(`#rsvpName`, `#btnYes`, `#btnNo`, `#rsvpGuests`, `#rsvpMsg`, `#rsvpSubmit`, the map link, the
calendar button) are **already in the tab order**. A keyboard user on the envelope screen tabs
into invisible off-screen form fields. `body.envelope-locked` only sets `overflow: hidden`
([index.html:41](index.html#L41)); it does not `inert` or `aria-hidden` the invitation.

**Fix:** make both gates `<button>` (or add `role="button" tabindex="0"` + Enter/Space handling),
and put `inert` on `#invite` until it is shown.

---

### D11 — P2 — No meta description and no Open Graph / Twitter card

The document has exactly two `<meta>` tags: `charset` and `viewport`. For an invitation whose
entire distribution channel is a pasted link in WhatsApp and Instagram DMs, that means **no preview
image, no title card, no description** — just a bare URL.

**Fix:** add `meta description`, `og:title`, `og:description`, `og:image` (an absolute URL to a
1200×630 image), `og:url`, `og:type`, and `twitter:card=summary_large_image`.

---

### D12 — P2 — Status messages and toggle states are not announced to screen readers

| Element | Missing |
|---|---|
| `#rsvpStatus` ([index.html:1865](index.html#L1865)) | no `role="status"` / `aria-live` — validation and error text is never announced |
| `#messagesPanel` ([index.html:1724](index.html#L1724)) | no `role`, no `aria-live` — loading, error and new-wish states silent |
| `#musicToggle` ([index.html:1705](index.html#L1705)) | no `aria-pressed`; static label "Mute or unmute music" never reflects state |

The RSVP *success* message does correctly carry `role="status"` — the inline error path just needs
the same treatment.

---

### D13 — P2 — Language and direction metadata

`<html lang="id">`, but the envelope, letter and hero are English ("A love letter to forever",
"Tap to open", "Dear Guests,"), and the Qur'anic verse carries neither `lang="ar"` nor `dir="rtl"`
([index.html:1790](index.html#L1790)). Screen readers will read the Arabic with an Indonesian voice
and may mis-order the bidi text.

**Fix:** `lang="ar" dir="rtl"` on `.arabic-text`, `lang="en"` on the English blocks.

---

### D14 — P2 — `prefers-reduced-motion` is ignored by the typewriter, and the tap affordance appears ~4.5 s late

The CSS honours reduced motion (`.wi-root * { animation: none; transition-duration: 0.01ms }`),
but `typeWriter()` is pure JS with no such check. With reduced motion enabled, the envelope still
types character-by-character for ~3.5 s and the letter for ~4.9 s. WCAG 2.2.2 asks for a way to
pause or skip.

Related: the "Tap to open" hint is the *last* item in the chain — heading (1.08 s) → "Kepada Yth."
(0.72 s) → guest name (~0.78 s) → hint (0.72 s) — so the only instruction on screen does not appear
until ~4.5 s after load, while the envelope is already tappable. Guests who tap early get an
animation they may read as a mis-tap.

**Fix:** short-circuit `typeWriter` to `el.textContent = text` under reduced motion; show the hint
earlier or in parallel.

---

### D15 — P2 — Cards take up to 2.3 s to become readable after entering the viewport

`.reveal-el` transitions run **1.15 s** ([index.html:982](index.html#L982)) and are staggered by
`i * 0.19 s` per element within a section ([index.html:2194](index.html#L2194)). For the events
card (7 reveal elements) the last item finishes at `1.14 + 1.15 = 2.29 s`; the RSVP card at
`0.95 + 1.15 = 2.10 s`.

With scroll-snap and tap-to-advance, a guest moving briskly will repeatedly land on cards that are
still substantially blank. I captured intermediate frames where the events card showed only its
"RANGKAIAN ACARA" heading, and where the couple's names had not yet appeared above their parents'
names.

*Caveat:* the browser-pane screenshot pipeline in this session lagged the DOM by a few seconds, so
I cannot certify the exact on-device duration from the screenshots alone. The CSS numbers above are
read directly from the stylesheet and are not in doubt.

**Fix:** ~0.5–0.6 s duration and ~0.08 s stagger keeps the effect and roughly quarters the wait.

---

### D16 — P2 — The wishes panel auto-opens after RSVP and covers the confirmation it just produced

`submitRsvp()` → `prependMessage()` adds `.open` to the panel. Captured on mobile: the success line
"Terima kasih, kami tunggu kehadiran Anda." is half-hidden behind wish bubbles and the section
heading is clipped from "KONFIRMASI KEHADIRAN" to "KEHADIRAN". Because the bubbles are translucent
over a busy painted background with no scrim, both layers are hard to read at once.

Separately, the panel has **no close button** — only a second tap on the floating toggle dismisses it.

**Fix:** delay opening the panel until the confirmation has been read (or scroll the confirmation
into a clear area first), add a scrim behind the panel, and give it an explicit close control.

---

### D17 — P2 — Long names and messages are silently truncated

`#rsvpName` and `#rsvpMsg` have **no `maxlength`** (`maxLength === -1` on both). The Apps Script
truncates to 120 and 1000 characters respectively. A guest who writes a heartfelt 1,500-character
message gets it cut mid-sentence with no warning and no way to know.

**Fix:** `maxlength="120"` / `maxlength="1000"` with a visible character counter on the message field.

---

### D18 — P2 — The read-only name field looks editable and offers no recourse

When `?to=` is present the name input is `readOnly` but is styled identically to an editable field.
A guest whose name is misspelled or mis-hyphenated in the link (very likely, since `?to=` maps `-`
to spaces) cannot correct it and is given no explanation.

**Fix:** style read-only distinctly and add a hint such as "Nama sesuai undangan — hubungi kami bila
perlu diperbaiki."

---

### D19 — P2 — No `<noscript>` fallback, and no error isolation

There is no `<noscript>`. With JS disabled or broken the guest sees a sealed envelope and nothing
else — no date, no venue, no way to RSVP. All behaviour also lives in one inline `<script>` with no
error boundaries, so a single early throw (a renamed id, a missing element) leaves the page
permanently stuck on the envelope.

**Fix:** add a `<noscript>` block with the date, venue and a contact number.

---

### D20 — P2 — Duplicate RSVPs, and a race in the Apps Script writer

The form is replaced on success, so a guest cannot double-submit in one session — but a reload gives
a fresh form and a second row is accepted. The production sheet already contains exact duplicates
(D6). `doPost` derives `No` from `sheet.getLastRow()` with no `LockService`, so simultaneous
submissions can produce colliding numbers.

**Fix:** wrap `doPost` in a script lock; upsert on name (or store a client id in `localStorage` and
show "Anda sudah konfirmasi" on return).

---

### D21 — P3 — `doPost` has no error handling

`JSON.parse(e.postData.contents || '{}')` throws on a malformed body or a missing `postData`, and
there is no `try`/`catch`, so Apps Script returns an HTML error page instead of the JSON contract
the client expects. The client's generic "coba lagi" message then hides what is actually a
permanent bad-request.

---

### D22 — P3 — Dead code: the ICS export

`addToCalendar()` builds a full `.ics` and triggers a download, but **no control calls it** — the
calendar button is wired to `addToGoogleCalendar()`. Its `DTSTAMP` is also wrong (set to the event
start rather than the generation time). Either wire it up as an "Apple/Outlook Calendar" option or
delete it.

---

### D23 — P3 — Floating controls are very low contrast

Both floating buttons use `rgba(251,248,240,0.5)` with a blur over busy painted backgrounds. On
desktop the mute button is also noticeably smaller than the mobile one. Guests are likely to miss
the wishes button entirely.

---

### D24 — P3 — Desktop polish

- A hard vertical seam is visible where the letter scene's background meets the invitation column's
  background (~x 1065 at 1280 px wide); the two images differ in tone (left greener, right greyer).
- The hero eyebrow wraps as "AN INTIMATE CELEBRATION OF / LOVE".
- On mobile the same eyebrow wraps as "AN INTIMATE CELEBRATION / OF LOVE".

---

### D25 — P3 — Countdown after the event

Once 23 Aug 2026 08:00 WIB passes, the countdown clamps to `00:00:00:00` and sits there. A "Kami
telah menikah — terima kasih" state would be kinder, and the page will stay live long after.

---

### D26 — P3 — No test, lint or typecheck scripts

`package.json` defines only `dev`, `build`, `preview`, and the Pages workflow runs only `npm ci` +
`npm run build`. Nothing would have caught D1, D2 or D3.

---

### D27 — P3 — `SHEET_ID` is committed

`apps-script/Code.gs:11` contains the live spreadsheet ID. AGENTS.md explicitly says to keep
spreadsheet IDs out of commits. It is not a credential on its own (the sheet still needs
permissions), but it narrows an attacker's work and contradicts the project's own rule.

---

### Minor observation — envelope→letter cross-fade overlaps by design

`.envelope-scene` fades over **1.6 s** ([index.html:74](index.html#L74)) starting at the 1.9 s mark,
while the letter is un-hidden and starts typing at that same instant. So there is a ~1.6 s window in
which both scenes are composited (`position: fixed; inset: 0; z-index: 20` each). I captured one
frame in that window showing the letter text over the still-opaque green envelope — dark green on
olive, effectively illegible — with the envelope's address and a second "TAP TO OPEN" showing
through. Given the screenshot lag noted in D15 I cannot pin the exact on-device duration, but the
overlap itself follows directly from the CSS. Delaying `typeLetterContents()` until the envelope has
finished fading would remove it.

---

## 4. Prioritised improvement plan

### Before sending any invitation out

1. **D1** — move `pointer-events: auto` to `.messages-panel.open .msg-bubble`; add
   `visibility: hidden` to the closed panel. *(one-line CSS fix, unblocks the envelope)*
2. **D2** — re-evaluate the 1000 px breakpoint on resize in `openLetter`. *(~10 lines)*
3. **D6** — delete the test/political rows from the sheet; add an `Approved` column and filter
   `doGet` on it.
4. **D9** — `git mv CNAME public/CNAME`; remove the `.DS_Store` files.
5. **D3** — reset `messagesLoaded` on failure and add a retry affordance.

### Before the invitation goes wide (performance & reach)

6. **D7** — extract the base64 payloads to real files; re-encode `main-background-mobile.png`
   (2.6 MB → ~100 KB); load only the background matching the viewport; move Google Fonts out of
   `@import`. *Biggest single win for Indonesian mobile guests.*
7. **D8** — swap Web Audio for a streaming `<audio>` element.
8. **D4** — make the wishes fetch lazy.
9. **D11** — add OG/Twitter meta so the shared link renders a preview card.
10. **D10** — make the envelope and letter real buttons; `inert` the invitation until shown.

### Quality and polish

11. **D5** — restrict `doGet` output and add a write token / rate limit.
12. **D12**, **D13** — `role="status"`, `aria-pressed`, `aria-live`; `lang`/`dir` on the Arabic verse.
13. **D14**, **D15** — honour `prefers-reduced-motion`; cut reveal duration to ~0.5 s and stagger
    to ~0.08 s; surface the tap hint sooner.
14. **D16**, **D17**, **D18** — don't cover the confirmation; add `maxlength` + counter; style the
    read-only name field.
15. **D19**, **D20**, **D21** — `<noscript>` fallback; `LockService` + dedupe; `try`/`catch` in `doPost`.
16. **D22**–**D27** — remove or wire up the ICS export; raise floating-button contrast; fix the
    desktop seam and eyebrow wrapping; post-event countdown state; add a smoke test to CI; move
    `SHEET_ID` to Script Properties.

### Suggested minimal CI addition

Nothing in the pipeline today could have caught D1–D3. A single Playwright smoke test would:

- load `/?to=Test-Guest`, tap the **centre** of the envelope, assert the letter appears (catches D1)
- open the letter at 1024 px, resize to 768 px, assert an invitation control is clickable (catches D2)
- fail the wishes fetch, reopen the panel, assert a second request is made (catches D3)

---

## 5. What is genuinely solid

Worth stating plainly, because it is most of the app:

- **XSS handling is correct.** Both render paths escape properly — `escapeHtml()` for the bulk
  render and `textContent` for the optimistic append. An `<img onerror>` payload came back as
  visible text with no element injected.
- **All date and time arithmetic is right.** Countdown, the Google Calendar link
  (08:00–13:00 WIB), the printed schedule and the mini-calendar all agree.
- **RSVP happy path, validation and failure recovery all behave correctly** — including restoring
  the button label and re-enabling submit after a 500, which is the kind of thing that is usually
  broken.
- **Personalisation is threaded correctly** through the envelope, the letter greeting and the
  pre-filled RSVP name, with a sensible fallback when `?to=` is absent.
- **Music lifecycle is well handled** — offset preserved across mute/unmute, paused on tab hide,
  resumed on return, stopped on `pagehide`.
- **Clean console** through the entire flow, and the production build is fast and warning-free.
- **The design is genuinely lovely.** Every defect above is a mechanical fix; none of them require
  rethinking the concept.
