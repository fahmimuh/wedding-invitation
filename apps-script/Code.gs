/**
 * Google Apps Script RSVP endpoint.
 *
 * Script Properties required:
 * - SHEET_ID: target spreadsheet ID
 *
 * Deploy as a Web app: execute as Me, access Anyone.
 */
const SHEET_NAME = 'RSVP';
const HEADERS = ['No', 'Submitted at', 'Name', 'Attending', 'Guests', 'Message', 'Submission ID', 'Approved'];

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID Script Property is not configured');
  const spreadsheet = SpreadsheetApp.openById(sheetId);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  } else {
    const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    HEADERS.forEach(function(header) {
      if (existing.indexOf(header) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        existing.push(header);
      }
    });
  }
  return sheet;
}

function columnMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.reduce(function(map, header, index) {
    map[String(header)] = index;
    return map;
  }, {});
}

function doGet() {
  try {
    const sheet = getSheet_();
    const columns = columnMap_(sheet);
    const values = sheet.getDataRange().getValues();
    const entries = values.slice(1).reverse().filter(function(row) {
      return String(row[columns.Approved]).toLowerCase() === 'true' &&
        String(row[columns.Message] || '').trim();
    }).map(function(row) {
      return {
        name: String(row[columns.Name] || ''),
        message: String(row[columns.Message] || '')
      };
    });
    return json_(entries);
  } catch (error) {
    return json_({ok: false, error: String(error.message || error)});
  }
}

function validateEntry_(body) {
  const name = String(body.name || '').trim();
  const message = String(body.message || '').trim();
  const submissionId = String(body.submissionId || '').trim();
  const guests = Number(body.guests || 0);
  if (!name) throw new Error('Name is required');
  if (name.length > 120) throw new Error('Name is too long');
  if (message.length > 1000) throw new Error('Message is too long');
  if (!submissionId || submissionId.length > 100) throw new Error('Invalid submission ID');
  if (!Number.isInteger(guests) || guests < 0 || guests > 4) throw new Error('Invalid guest count');
  return {
    name: name,
    attending: Boolean(body.attending),
    guests: Boolean(body.attending) ? guests : 0,
    message: message,
    submissionId: submissionId
  };
}

function doPost(e) {
  let lock;
  try {
    const body = JSON.parse(e && e.postData && e.postData.contents || '{}');
    const entry = validateEntry_(body);
    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    const sheet = getSheet_();
    const columns = columnMap_(sheet);
    const values = sheet.getDataRange().getValues();
    let rowNumber = 0;
    for (let index = 1; index < values.length; index += 1) {
      if (String(values[index][columns['Submission ID']] || '') === entry.submissionId) {
        rowNumber = index + 1;
        break;
      }
    }

    const row = new Array(sheet.getLastColumn()).fill('');
    row[columns.No] = rowNumber ? values[rowNumber - 1][columns.No] : sheet.getLastRow();
    row[columns['Submitted at']] = new Date();
    row[columns.Name] = entry.name;
    row[columns.Attending] = entry.attending;
    row[columns.Guests] = entry.guests;
    row[columns.Message] = entry.message;
    row[columns['Submission ID']] = entry.submissionId;
    row[columns.Approved] = false;

    if (rowNumber) sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return json_({ok: true, updated: Boolean(rowNumber)});
  } catch (error) {
    return json_({ok: false, error: String(error.message || error)});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
