function monthlyCleanup() {
  try {
    const ss = getSpreadsheet_();
    repairValidationAndFormatting();
    updateDashboard();
    appendLog_(ss, "monthly_cleanup", { name: "", room: "", phone: "" }, "", "system", "Validation, formatting, and dashboard refreshed.");
  } catch (error) {
    handleWorkflowError_("monthlyCleanup", error, null);
  }
}
