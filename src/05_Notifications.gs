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
    "New FDH WhatsApp registration.",
    "",
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
    subject: "New FDH Registration - Please Review",
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

function notifyWAAdmins_(ss, record) {
  const emails = getEmailList_(ss, FDH.sheets.waAdmins);
  if (emails.length === 0) {
    throw new Error("No WhatsApp admin emails configured.");
  }

  MailApp.sendEmail({
    to: emails.join(","),
    subject: "Verified FDH resident waiting for WhatsApp approval",
    body: [
      "A resident has been verified and should be accepted into the WhatsApp group.",
      "",
      `Name: ${record.name}`,
      `Room: ${record.room}`,
      `Phone: ${record.phone}`,
      `Email: ${record.email}`,
      "",
      "Please accept this person's WhatsApp join request if it appears."
    ].join("\n")
  });
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
