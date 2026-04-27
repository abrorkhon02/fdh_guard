function appendLog_(ss, action, record, status, actor, details) {
  const sheet = ensureSheet_(ss, FDH.sheets.log);
  ensureLogSheet_(ss);

  sheet.appendRow([
    new Date(),
    record.name || "",
    record.room || "",
    record.phone || "",
    status || "",
    actor || "",
    action || "",
    details || ""
  ]);
}
