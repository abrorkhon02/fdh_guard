function handleStatusEdit(e) {
  try {
    if (!isStatusEdit_(e)) return;

    const ss = getSpreadsheet_();
    const sheet = e.range.getSheet();
    const row = e.range.getRow();
    const oldStatus = normalizeStatus_(e.oldValue || FDH.statuses.pending);
    const newStatus = normalizeStatus_(e.value);
    const actor = getActorEmail_(e);

    if (FDH.statusOptions.indexOf(newStatus) === -1) {
      e.range.setValue(oldStatus || FDH.statuses.pending);
      showAlert_("Invalid status", `Allowed statuses: ${FDH.statusOptions.join(", ")}`);
      return;
    }

    if (!isConfiguredVerifier_(ss, actor)) {
      e.range.setValue(oldStatus || FDH.statuses.pending);
      const record = getRecordFromRow_(sheet, row);
      appendLog_(ss, "unauthorized_status_edit", record, oldStatus, actor, `Attempted status: ${newStatus}`);
      showAlert_("Not authorized", "Only configured DataVerifiers should approve, reject, or move residents out.");
      return;
    }

    if (newStatus === FDH.statuses.approved) {
      processApprovalEdit_(ss, sheet, row, oldStatus, actor);
      return;
    }

    if (newStatus === FDH.statuses.rejected) {
      processRejectedEdit_(ss, sheet, row, oldStatus, actor);
      return;
    }

    if (newStatus === FDH.statuses.movedOut) {
      processMovedOutEdit_(ss, sheet, row, oldStatus, actor);
      return;
    }

    updateDashboard();
  } catch (error) {
    handleWorkflowError_("handleStatusEdit", error, e);
  }
}

function isStatusEdit_(e) {
  if (!e || !e.range || !e.value) return false;

  const range = e.range;
  return (
    range.getSheet().getName() === FDH.sheets.responses &&
    range.getColumn() === FDH.columns.status &&
    range.getRow() > 1 &&
    range.getNumRows() === 1 &&
    range.getNumColumns() === 1
  );
}

function processApprovalEdit_(ss, sheet, row, oldStatus, actor) {
  const confirmed = confirm_(
    "Approve resident?",
    "A confirmation email will be sent to the tenant, and WhatsApp admins will be notified to accept this person."
  );

  if (!confirmed) {
    sheet.getRange(row, FDH.columns.status).setValue(oldStatus || FDH.statuses.pending);
    return;
  }

  withDocumentLock_(() => {
    const record = getRecordFromRow_(sheet, row);
    const missing = validateRequiredRecord_(record);
    const inviteLink = getInviteLink_(ss);

    if (missing.length) {
      sheet.getRange(row, FDH.columns.status).setValue(oldStatus || FDH.statuses.pending);
      setReviewNotes_(sheet, row, `Approval blocked. Missing: ${missing.join(", ")}`);
      showAlert_("Approval blocked", `Missing required fields: ${missing.join(", ")}`);
      return;
    }

    if (!isValidInviteLink_(inviteLink)) {
      sheet.getRange(row, FDH.columns.status).setValue(oldStatus || FDH.statuses.pending);
      setReviewNotes_(sheet, row, "Approval blocked. Config!B1 must contain a real https://chat.whatsapp.com/... invite link.");
      showAlert_("Approval blocked", "Set a real WhatsApp group invite link in Config!B1 first.");
      return;
    }

    if (getEmailList_(ss, FDH.sheets.waAdmins).length === 0) {
      sheet.getRange(row, FDH.columns.status).setValue(oldStatus || FDH.statuses.pending);
      setReviewNotes_(sheet, row, "Approval blocked. No WhatsApp admin emails configured.");
      showAlert_("Approval blocked", "Add at least one WhatsApp admin email in WAAdmins!A2:A.");
      return;
    }

    const now = new Date();
    const movedOutResidents = moveOutPreviousResidents_(sheet, record.normalizedRoom, row, now, actor);
    const movedOutRows = movedOutResidents.map((resident) => resident.row);

    sheet.getRange(row, FDH.columns.approvedBy).setValue(actor);
    sheet.getRange(row, FDH.columns.approvedAt).setValue(now);
    sheet.getRange(row, FDH.columns.inviteLink).setValue(inviteLink);
    setReviewNotes_(sheet, row, movedOutRows.length ? `Approved. Previous resident row(s) moved out: ${movedOutRows.join(", ")}` : "Approved.");

    const approvedRecord = getRecordFromRow_(sheet, row);
    approvedRecord.inviteLink = inviteLink;

    notifyTenantApproved_(approvedRecord, inviteLink);
    notifyWAAdmins_(ss, approvedRecord, movedOutResidents);
    appendLog_(ss, "approved", approvedRecord, FDH.statuses.approved, actor, movedOutRows.length ? `Moved out rows: ${movedOutRows.join(", ")}` : "");
    updateDashboard();

    showAlert_("Resident approved", "Tenant and WhatsApp admins were notified.");
  });
}

function processRejectedEdit_(ss, sheet, row, oldStatus, actor) {
  const prompt = promptText_(
    "Reject registration?",
    "Optional: write a reason/message for the tenant. If left empty, the rejection is logged only and no tenant email is sent. Press Cancel to keep the previous status."
  );

  if (!prompt.confirmed) {
    sheet.getRange(row, FDH.columns.status).setValue(oldStatus || FDH.statuses.pending);
    return;
  }

  withDocumentLock_(() => {
    const record = getRecordFromRow_(sheet, row);
    const reason = prompt.text;
    const notes = [`Rejected by ${actor} at ${new Date().toISOString()}.`];
    let details = "";

    sheet.getRange(row, FDH.columns.approvedBy).clearContent();
    sheet.getRange(row, FDH.columns.approvedAt).clearContent();
    sheet.getRange(row, FDH.columns.inviteLink).clearContent();

    if (reason && looksLikeEmail_(record.email)) {
      notifyTenantRejected_(record, reason);
      notes.push(`Tenant rejection message sent: ${reason}`);
      details = `Tenant notified. Reason: ${reason}`;
    } else if (reason) {
      notes.push(`Tenant rejection message not sent because email is missing or invalid: ${reason}`);
      details = `Tenant not notified because email is missing or invalid. Reason: ${reason}`;
    } else {
      notes.push("No tenant rejection message entered. Tenant was not emailed.");
      details = "No tenant message entered.";
    }

    setReviewNotes_(sheet, row, notes.join("\n"));
    appendLog_(ss, "rejected", record, FDH.statuses.rejected, actor, details);
    updateDashboard();
  });
}

function processMovedOutEdit_(ss, sheet, row, oldStatus, actor) {
  const confirmed = confirm_("Mark resident as moved out?", "LeftAt will be filled if it is currently empty.");

  if (!confirmed) {
    sheet.getRange(row, FDH.columns.status).setValue(oldStatus || FDH.statuses.pending);
    return;
  }

  const record = getRecordFromRow_(sheet, row);

  if (!record.leftAt) {
    sheet.getRange(row, FDH.columns.leftAt).setValue(new Date());
  }

  const movedOutRecord = getRecordFromRow_(sheet, row);
  notifyWAAdminsMovedOut_(ss, movedOutRecord);
  appendLog_(ss, "moved_out_manual", movedOutRecord, FDH.statuses.movedOut, actor, "WA admins notified to remove resident.");
  updateDashboard();
}

function moveOutPreviousResidents_(sheet, normalizedRoom, approvedRow, movedOutAt, actor) {
  const previousResidents = findApprovedResidentsInRoom_(sheet, normalizedRoom, approvedRow);
  const ss = sheet.getParent();

  return previousResidents.map((resident) => {
    sheet.getRange(resident.row, FDH.columns.status).setValue(FDH.statuses.movedOut);
    sheet.getRange(resident.row, FDH.columns.leftAt).setValue(movedOutAt);

    const movedRecord = getRecordFromRow_(sheet, resident.row);
    appendLog_(ss, "moved_out_auto", movedRecord, FDH.statuses.movedOut, actor, `New approved row: ${approvedRow}`);
    return movedRecord;
  });
}
