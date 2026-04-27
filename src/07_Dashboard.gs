function updateDashboard() {
  const ss = getSpreadsheet_();
  const responseSheet = getSheet_(ss, FDH.sheets.responses);
  const dashboardSheet = getSheet_(ss, FDH.sheets.dashboard);
  const counts = {};

  FDH.statusOptions.forEach((status) => {
    counts[status] = 0;
  });

  if (responseSheet.getLastRow() >= 2) {
    const statuses = responseSheet
      .getRange(2, FDH.columns.status, responseSheet.getLastRow() - 1, 1)
      .getValues()
      .flat()
      .map(normalizeStatus_);

    statuses.forEach((status) => {
      if (counts[status] === undefined) counts[status] = 0;
      if (status) counts[status]++;
    });
  }

  const rows = [
    ["Metric", "Value"],
    ["Approved", counts[FDH.statuses.approved] || 0],
    ["Pending", counts[FDH.statuses.pending] || 0],
    ["Rejected", counts[FDH.statuses.rejected] || 0],
    ["Moved Out", counts[FDH.statuses.movedOut] || 0],
    ["Last Updated", new Date()]
  ];

  dashboardSheet.clearContents();
  dashboardSheet.getRange(1, 1, rows.length, 2).setValues(rows);
  dashboardSheet.getRange("A1:B1").setFontWeight("bold");
  dashboardSheet.getRange("B6").setNumberFormat("yyyy-mm-dd hh:mm:ss");
  dashboardSheet.autoResizeColumns(1, 2);
}
