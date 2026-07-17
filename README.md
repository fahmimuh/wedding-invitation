# Wedding Invitation

Static wedding invitation based on the supplied HTML design. It can be deployed to GitHub Pages, Netlify, Vercel, or any static host.

## RSVP + wishes setup

The invitation uses a Google Sheet as the source of truth:

1. Create a Google Sheet.
2. Open **Extensions → Apps Script** and paste [`apps-script/Code.gs`](apps-script/Code.gs).
3. Replace `PASTE_GOOGLE_SHEET_ID_HERE` with the spreadsheet ID.
4. Deploy the Apps Script as a **Web app**, executing as you and accessible to anyone.
5. Copy the deployment URL into `RSVP_API_URL` near the top of [`index.html`](index.html).

When the URL is left blank, the page uses browser `localStorage` so the design can still be previewed locally. Once configured, RSVP submissions are written to the spreadsheet and the wishes drawer reads approved-by-presence messages from the same sheet.

## Local preview

Because this is a static project, no build step is required:

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## Deployment

For GitHub Pages, push the repository and enable Pages with **GitHub Actions**; the included workflow handles deployment on every push to `main`. Netlify and Vercel can deploy the repository with no build command and no publish directory changes.
