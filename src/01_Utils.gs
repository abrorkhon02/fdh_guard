function getSpreadsheet_() {
  if (FDH_SPREADSHEET_ID) {
    return SpreadsheetApp.openById(FDH_SPREADSHEET_ID);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("No active spreadsheet. Bind this script to the response spreadsheet or set FDH_SPREADSHEET_ID.");
  }
  return ss;
}

function getSheet_(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error(`Missing sheet: ${name}`);
  }
  return sheet;
}

function ensureSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function sanitizeRoom(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeStatus_(input) {
  return String(input || "").trim().toLowerCase();
}

function normalizeEmail_(input) {
  return String(input || "").trim().toLowerCase();
}

function looksLikeEmail_(input) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input || "").trim());
}

function isValidInviteLink_(input) {
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+/i.test(String(input || "").trim());
}

function isBlank_(input) {
  return input === null || input === undefined || String(input).trim() === "";
}

function withDocumentLock_(callback) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(FDH.lockTimeoutMs);

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getActorEmail_(e) {
  if (e && e.user && typeof e.user.getEmail === "function") {
    const eventEmail = normalizeEmail_(e.user.getEmail());
    if (eventEmail) return eventEmail;
  }

  const activeEmail = normalizeEmail_(Session.getActiveUser().getEmail());
  if (activeEmail) return activeEmail;

  return "unknown";
}

function getEmailList_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .flat()
    .map(normalizeEmail_)
    .filter(Boolean)
    .filter((email, index, emails) => emails.indexOf(email) === index);
}

function isConfiguredVerifier_(ss, actorEmail) {
  const actor = normalizeEmail_(actorEmail);
  if (!actor || actor === "unknown") return true;

  const verifiers = getEmailList_(ss, FDH.sheets.dataVerifiers);
  if (verifiers.length === 0) return true;

  return verifiers.indexOf(actor) !== -1;
}

function getInviteLink_(ss) {
  const sheet = getSheet_(ss, FDH.sheets.config);
  return String(sheet.getRange(FDH.configCells.inviteLink).getValue() || "").trim();
}

function getRecordFromRow_(sheet, row) {
  const values = sheet.getRange(row, 1, 1, FDH.columns.reviewNotes).getValues()[0];

  return {
    row,
    timestamp: values[FDH.columns.timestamp - 1],
    email: String(values[FDH.columns.email - 1] || "").trim(),
    name: String(values[FDH.columns.name - 1] || "").trim(),
    room: String(values[FDH.columns.room - 1] || "").trim(),
    normalizedRoom: sanitizeRoom(values[FDH.columns.room - 1]),
    phone: String(values[FDH.columns.phone - 1] || "").trim(),
    status: normalizeStatus_(values[FDH.columns.status - 1]),
    approvedBy: String(values[FDH.columns.approvedBy - 1] || "").trim(),
    nameplate: String(values[FDH.columns.nameplate - 1] || "").trim(),
    consent: String(values[FDH.columns.consent - 1] || "").trim(),
    inviteLink: String(values[FDH.columns.inviteLink - 1] || "").trim(),
    leftAt: values[FDH.columns.leftAt - 1],
    approvedAt: values[FDH.columns.approvedAt - 1],
    reviewNotes: String(values[FDH.columns.reviewNotes - 1] || "").trim()
  };
}

function validateRequiredRecord_(record) {
  const missing = [];
  if (!record.email) missing.push("email");
  if (record.email && !looksLikeEmail_(record.email)) missing.push("valid email");
  if (!record.name) missing.push("name");
  if (!record.normalizedRoom) missing.push("room");
  if (!record.phone) missing.push("phone");
  if (!record.nameplate) missing.push("nameplate/postbox upload");
  if (!record.consent) missing.push("consent");
  return missing;
}

function isManagedResponseHeaderColumn_(col) {
  return [
    FDH.columns.status,
    FDH.columns.approvedBy,
    FDH.columns.inviteLink,
    FDH.columns.leftAt,
    FDH.columns.approvedAt,
    FDH.columns.reviewNotes
  ].indexOf(col) !== -1;
}

function setReviewNotes_(sheet, row, notes) {
  sheet.getRange(row, FDH.columns.reviewNotes).setValue(notes || "");
}

function appendReviewNote_(sheet, row, note) {
  const cell = sheet.getRange(row, FDH.columns.reviewNotes);
  const existing = String(cell.getValue() || "").trim();
  const value = existing ? `${existing}\n${note}` : note;
  cell.setValue(value);
}

function findApprovedResidentsInRoom_(sheet, normalizedRoom, excludedRow) {
  if (!normalizedRoom || sheet.getLastRow() < 2) return [];

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, FDH.columns.reviewNotes).getValues();
  const matches = [];

  data.forEach((values, index) => {
    const row = index + 2;
    if (row === excludedRow) return;

    const rowRoom = sanitizeRoom(values[FDH.columns.room - 1]);
    const rowStatus = normalizeStatus_(values[FDH.columns.status - 1]);

    if (rowRoom === normalizedRoom && rowStatus === FDH.statuses.approved) {
      matches.push({
        row,
        name: String(values[FDH.columns.name - 1] || "").trim(),
        room: String(values[FDH.columns.room - 1] || "").trim(),
        phone: String(values[FDH.columns.phone - 1] || "").trim(),
        email: String(values[FDH.columns.email - 1] || "").trim()
      });
    }
  });

  return matches;
}

function showAlert_(title, message) {
  SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function confirm_(title, message) {
  const response = SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.YES_NO);
  return response === SpreadsheetApp.getUi().Button.YES;
}
