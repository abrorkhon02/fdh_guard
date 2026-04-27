function handleFormSubmit(e) {
  try {
    withDocumentLock_(() => {
      const ss = getSpreadsheet_();
      const sheet = getSheet_(ss, FDH.sheets.responses);
      const row = getSubmittedRow_(e, sheet);

      if (!row || row <= 1) {
        throw new Error("Could not identify submitted response row.");
      }

      const record = getRecordFromRow_(sheet, row);
      const missing = validateRequiredRecord_(record);
      const collisions = findApprovedResidentsInRoom_(sheet, record.normalizedRoom, row);
      const notes = [];

      if (missing.length) {
        notes.push(`Missing required fields: ${missing.join(", ")}`);
      }

      if (collisions.length) {
        notes.push(`Room already has approved resident(s): ${collisions.map((item) => `row ${item.row} ${item.name}`).join("; ")}`);
      }

      sheet.getRange(row, FDH.columns.status).setValue(FDH.statuses.pending);
      sheet.getRange(row, FDH.columns.approvedBy).clearContent();
      sheet.getRange(row, FDH.columns.inviteLink).clearContent();
      sheet.getRange(row, FDH.columns.approvedAt).clearContent();
      setReviewNotes_(sheet, row, notes.join("\n"));

      notifyDataVerifiers_(ss, record, missing, collisions);
      const applicantNotified = notifyTenantApplicationReceived_(record);
      const details = notes.slice();
      details.push(applicantNotified ? "Applicant confirmation email sent." : "Applicant confirmation email not sent because email is missing or invalid.");

      appendLog_(ss, "form_submit", record, FDH.statuses.pending, "system", details.join(" | "));
      updateDashboard();
    });
  } catch (error) {
    handleWorkflowError_("handleFormSubmit", error, e);
  }
}

function getSubmittedRow_(e, sheet) {
  if (e && e.range && typeof e.range.getRow === "function") {
    return e.range.getRow();
  }

  if (e && e.values && e.values.length) {
    const submittedEmail = normalizeEmail_(e.values[FDH.columns.email - 1]);
    const submittedRoom = sanitizeRoom(e.values[FDH.columns.room - 1]);
    const data = sheet.getDataRange().getValues();

    for (let index = data.length - 1; index >= 1; index--) {
      const rowEmail = normalizeEmail_(data[index][FDH.columns.email - 1]);
      const rowRoom = sanitizeRoom(data[index][FDH.columns.room - 1]);
      const rowStatus = normalizeStatus_(data[index][FDH.columns.status - 1]);

      if (rowEmail === submittedEmail && rowRoom === submittedRoom && !rowStatus) {
        return index + 1;
      }
    }
  }

  return null;
}
