/**
 * Google Apps Script RSVP endpoint.
 *
 * 1. Create a Google Sheet and copy its ID from the URL.
 * 2. In Apps Script, add this file and set SHEET_ID below.
 * 3. Deploy > New deployment > Web app:
 *    Execute as: Me
 *    Who has access: Anyone
 * 4. Paste the deployment URL into RSVP_API_URL in index.html.
 */
const SHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'RSVP';

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Submitted at', 'Name', 'Attending', 'Guests', 'Message']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const entries = values.slice(1).map(function(row) {
    return {
      submittedAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ''),
      name: String(row[1] || ''),
      attending: String(row[2]).toLowerCase() === 'true',
      guests: Number(row[3] || 0),
      message: String(row[4] || '')
    };
  }).filter(function(entry) { return entry.name; });
  return ContentService
    .createTextOutput(JSON.stringify(entries))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || '{}');
  if (!body.name) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: 'Name is required'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  getSheet_().appendRow([
    new Date(),
    String(body.name).slice(0, 120),
    Boolean(body.attending),
    Number(body.guests || 0),
    String(body.message || '').slice(0, 1000)
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ok: true}))
    .setMimeType(ContentService.MimeType.JSON);
}
