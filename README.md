# Wedding Invitation

Vite-powered wedding invitation based on the supplied HTML design. The current visual markup stays in `index.html` while Vite provides the development server and production build pipeline. It can be deployed to GitHub Pages, Netlify, Vercel, or any static host.

## RSVP + wishes setup

The invitation uses a Google Sheet as the source of truth:

1. Create a Google Sheet.
2. Open **Extensions → Apps Script** and paste [`apps-script/Code.gs`](apps-script/Code.gs).
3. Replace `PASTE_GOOGLE_SHEET_ID_HERE` with the spreadsheet ID.
4. Deploy the Apps Script as a **Web app**, executing as you and accessible to anyone.
5. Copy the deployment URL into `RSVP_API_URL` near the top of [`index.html`](index.html).

When the URL is left blank, the page uses browser `localStorage` so the design can still be previewed locally. Once configured, RSVP submissions are written to the spreadsheet and the wishes drawer reads approved-by-presence messages from the same sheet.

## Local development

Install dependencies and start Vite:

```bash
npm install
npm run dev
```

Then open http://localhost:4173.

Create a production build with:

```bash
npm run build
```

## Deployment

For GitHub Pages, push the repository and enable Pages with **GitHub Actions**; the included workflow handles deployment on every push to `main`. Configure the workflow to publish `dist/` after the Vite build, or use Netlify/Vercel with build command `npm run build` and publish directory `dist`.
