function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(FDH.appName)
    .addItem("Run initial setup", "runInitialSetup")
    .addItem("Install triggers", "installTriggers")
    .addSeparator()
    .addItem("Update dashboard", "updateDashboard")
    .addItem("Repair validation and formatting", "repairValidationAndFormatting")
    .addToUi();
}

function runInitialSetup() {
  const ss = getSpreadsheet_();

  ensureCoreSheets_(ss);
  ensureResponseSheet_(ss);
  ensureLogSheet_(ss);
  ensureDashboardSheet_(ss);
  ensureConfigSheet_(ss);
  ensureAdminSheet_(ss, FDH.sheets.waAdmins);
  ensureAdminSheet_(ss, FDH.sheets.dataVerifiers);
  ensureAdminSheet_(ss, FDH.sheets.technicalAdmins);
  repairValidationAndFormatting();
  updateDashboard();

  SpreadsheetApp.getUi().alert("FDH Guard setup completed.");
}

function installTriggers() {
  const ss = getSpreadsheet_();
  const managedHandlers = ["handleFormSubmit", "handleStatusEdit", "monthlyCleanup"];

  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (managedHandlers.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("handleFormSubmit").forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger("handleStatusEdit").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("monthlyCleanup").timeBased().onMonthDay(1).atHour(0).create();

  SpreadsheetApp.getUi().alert("FDH Guard triggers installed.");
}

function ensureCoreSheets_(ss) {
  Object.keys(FDH.sheets).forEach((key) => ensureSheet_(ss, FDH.sheets[key]));
}

function ensureResponseSheet_(ss) {
  const sheet = getSheet_(ss, FDH.sheets.responses);

  if (sheet.getMaxColumns() < FDH.columns.reviewNotes) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), FDH.columns.reviewNotes - sheet.getMaxColumns());
  }

  for (let index = 0; index < FDH.responseHeaders.length; index++) {
    const col = index + 1;
    const current = String(sheet.getRange(1, col).getValue() || "").trim();

    if (!current || isManagedResponseHeaderColumn_(col)) {
      sheet.getRange(1, col).setValue(FDH.responseHeaders[index]);
    }
  }

  sheet.setFrozenRows(1);
}

function ensureLogSheet_(ss) {
  const sheet = getSheet_(ss, FDH.sheets.log);
  const firstCell = String(sheet.getRange(1, 1).getValue() || "").trim();

  if (firstCell !== FDH.logHeaders[0]) {
    if (!isBlank_(firstCell)) {
      sheet.insertRowBefore(1);
    }
    sheet.getRange(1, 1, 1, FDH.logHeaders.length).setValues([FDH.logHeaders]);
  }

  sheet.setFrozenRows(1);
}

function ensureDashboardSheet_(ss) {
  const sheet = getSheet_(ss, FDH.sheets.dashboard);
  sheet.getRange(1, 1, 1, 2).setValues([["Metric", "Value"]]);
  sheet.setFrozenRows(1);
}

function ensureConfigSheet_(ss) {
  const sheet = getSheet_(ss, FDH.sheets.config);

  if (isBlank_(sheet.getRange("A1").getValue())) {
    sheet.getRange("A1").setValue("Current WhatsApp Invite Link:");
  }

  if (isBlank_(sheet.getRange("B1").getValue())) {
    sheet.getRange("B1").setValue("PASTE_WHATSAPP_INVITE_LINK_HERE");
  }
}

function ensureAdminSheet_(ss, sheetName) {
  const sheet = getSheet_(ss, sheetName);

  if (isBlank_(sheet.getRange("A1").getValue())) {
    sheet.getRange("A1").setValue("Email");
  }

  sheet.setFrozenRows(1);
}

function repairValidationAndFormatting() {
  const ss = getSpreadsheet_();
  const sheet = getSheet_(ss, FDH.sheets.responses);

  ensureResponseSheet_(ss);
  applyStatusValidation_(sheet);
  applyStatusConditionalFormatting_(sheet);
  sheet.autoResizeColumns(1, FDH.columns.reviewNotes);
}

function applyStatusValidation_(sheet) {
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const range = sheet.getRange(2, FDH.columns.status, maxRows, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(FDH.statusOptions, true)
    .setAllowInvalid(false)
    .build();

  range.setDataValidation(rule);
}

function applyStatusConditionalFormatting_(sheet) {
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const range = sheet.getRange(2, 1, maxRows, FDH.columns.reviewNotes);

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$F2="${FDH.statuses.pending}"`)
      .setBackground("#fff2cc")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$F2="${FDH.statuses.approved}"`)
      .setBackground("#d9ead3")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$F2="${FDH.statuses.rejected}"`)
      .setBackground("#f4cccc")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$F2="${FDH.statuses.movedOut}"`)
      .setBackground("#d9d9d9")
      .setRanges([range])
      .build()
  ];

  const otherRules = sheet
    .getConditionalFormatRules()
    .filter((rule) => !rule.getRanges().some((ruleRange) => ruleRange.getSheet().getName() === sheet.getName()));

  sheet.setConditionalFormatRules(otherRules.concat(rules));
}
