function notifyDataVerifiers_(ss, record, missing, collisions) {
  const emails = getEmailList_(ss, FDH.sheets.dataVerifiers);
  if (emails.length === 0) {
    throw new Error("No DataVerifier emails configured.");
  }

  const warnings = [];
  if (missing.length) warnings.push(`Missing fields: ${missing.join(", ")}`);
  if (collisions.length) {
    warnings.push(`Existing approved resident(s) in room: ${collisions.map((item) => `row ${item.row} ${item.name}`).join("; ")}`);
  }

  const body = [
    "New FDH WhatsApp registration is waiting for review.",
    "",
    `Sheet row: ${record.row}`,
    `Name: ${record.name}`,
    `Room: ${record.room}`,
    `Phone: ${record.phone}`,
    `Email: ${record.email}`,
    `Nameplate/Postbox upload: ${record.nameplate || "-"}`,
    "",
    warnings.length ? `Warnings:\n- ${warnings.join("\n- ")}` : "Warnings: none",
    "",
    'Please verify the data and change Status to "approved" only if everything is correct.'
  ].join("\n");

  MailApp.sendEmail({
    to: emails.join(","),
    subject: `FDH registration pending review - ${record.room || "unknown room"}`,
    body
  });
}

function notifyTenantApproved_(record, inviteLink) {
  MailApp.sendEmail({
    to: record.email,
    subject: "FDH WhatsApp registration approved",
    body: [
      `Hello ${record.name},`,
      "",
      "Your FDH WhatsApp group registration has been approved.",
      "",
      `WhatsApp invite link: ${inviteLink}`,
      "",
      "Please open the link and request access to the WhatsApp group. A WhatsApp admin has been notified and will approve your join request manually.",
      "",
      "FDH Student Representatives"
    ].join("\n")
  });
}

function notifyTenantRejected_(record, reason) {
  MailApp.sendEmail({
    to: record.email,
    subject: "FDH WhatsApp registration not approved",
    body: [
      `Hello ${record.name || "there"},`,
      "",
      "Your FDH WhatsApp group registration was reviewed and could not be approved.",
      "",
      "Message from the verification team:",
      reason,
      "",
      "If you think this is a mistake, please submit the form again with corrected information or contact the FDH Student Representatives.",
      "",
      "FDH Student Representatives"
    ].join("\n")
  });
}

function notifyWAAdmins_(ss, record, movedOutResidents) {
  const emails = getEmailList_(ss, FDH.sheets.waAdmins);
  if (emails.length === 0) {
    throw new Error("No WhatsApp admin emails configured.");
  }

  const movedOut = movedOutResidents || [];
  const isReplacement = movedOut.length > 0;
  const subject = isReplacement
    ? `FDH WhatsApp room change - ${record.room}`
    : "Verified FDH resident waiting for WhatsApp approval";
  const body = isReplacement
    ? buildWAReplacementBody_(record, movedOut)
    : buildWAApprovalBody_(record);

  MailApp.sendEmail({
    to: emails.join(","),
    subject,
    body
  });
}

function notifyWAAdminsMovedOut_(ss, record) {
  const emails = getEmailList_(ss, FDH.sheets.waAdmins);
  if (emails.length === 0) {
    throw new Error("No WhatsApp admin emails configured.");
  }

  MailApp.sendEmail({
    to: emails.join(","),
    subject: `FDH WhatsApp removal needed - ${record.room}`,
    body: [
      "A resident was marked as moved out and should be removed from the WhatsApp group if still present.",
      "",
      "Remove from WhatsApp group:",
      formatResidentForEmail_(record),
      "",
      "No new resident was approved by this action."
    ].join("\n")
  });
}

function buildWAApprovalBody_(record) {
  return [
    "A resident has been verified and should be accepted into the WhatsApp group.",
    "",
    "Accept into WhatsApp group:",
    formatResidentForEmail_(record),
    "",
    "Please accept this person's WhatsApp join request if it appears."
  ].join("\n");
}

function buildWAReplacementBody_(record, movedOutResidents) {
  return [
    "A new resident has been verified for a room that already had approved resident(s).",
    "",
    "Accept this new resident into the WhatsApp group:",
    formatResidentForEmail_(record),
    "",
    "Remove these previous resident(s) from the WhatsApp group if still present:",
    movedOutResidents.map(formatResidentForEmail_).join("\n\n"),
    "",
    "Reason: the new resident was approved for the same room, so the previous approved resident(s) were marked as moved out in the sheet."
  ].join("\n");
}

function formatResidentForEmail_(record) {
  return [
    `Name: ${record.name || "-"}`,
    `Room: ${record.room || "-"}`,
    `Phone: ${record.phone || "-"}`,
    `Email: ${record.email || "-"}`,
    `Sheet row: ${record.row || "-"}`
  ].join("\n");
}

function notifyTechnicalAdmins_(ss, subject, body) {
  const technicalAdmins = getEmailList_(ss, FDH.sheets.technicalAdmins);
  const fallbackVerifiers = getEmailList_(ss, FDH.sheets.dataVerifiers);
  const emails = technicalAdmins.length ? technicalAdmins : fallbackVerifiers;

  if (emails.length === 0) return;

  MailApp.sendEmail({
    to: emails.join(","),
    subject,
    body
  });
}

function handleWorkflowError_(handlerName, error, event) {
  const message = error && error.stack ? error.stack : String(error);
  Logger.log(`${handlerName} failed: ${message}`);

  try {
    const ss = getSpreadsheet_();
    appendLog_(ss, "error", { name: "", room: "", phone: "" }, "error", "system", `${handlerName}: ${error.message || error}`);
    notifyTechnicalAdmins_(
      ss,
      `FDH Guard error in ${handlerName}`,
      [`${handlerName} failed.`, "", message, "", "Event summary:", summarizeEvent_(event)].join("\n")
    );
  } catch (notificationError) {
    Logger.log(`Error notification failed: ${notificationError}`);
  }
}

function summarizeEvent_(event) {
  if (!event) return "No event object.";

  const summary = {};
  if (event.value) summary.value = event.value;
  if (event.oldValue) summary.oldValue = event.oldValue;
  if (event.values) summary.values = event.values;
  if (event.namedValues) summary.namedValues = event.namedValues;
  if (event.range) {
    summary.range = event.range.getA1Notation();
    summary.sheet = event.range.getSheet().getName();
  }

  return JSON.stringify(summary, null, 2);
}
