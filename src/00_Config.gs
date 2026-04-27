const FDH_SPREADSHEET_ID = "";

const FDH = {
  appName: "FDH Guard",
  sheets: {
    responses: "Form_Responses",
    config: "Config",
    waAdmins: "WAAdmins",
    dataVerifiers: "DataVerifiers",
    technicalAdmins: "TechnicalAdmins",
    log: "Log",
    dashboard: "Dashboard"
  },
  columns: {
    timestamp: 1,
    email: 2,
    name: 3,
    room: 4,
    phone: 5,
    status: 6,
    approvedBy: 7,
    nameplate: 8,
    consent: 9,
    inviteLink: 10,
    leftAt: 11,
    approvedAt: 12,
    reviewNotes: 13
  },
  statuses: {
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
    movedOut: "moved out"
  },
  statusOptions: ["pending", "approved", "rejected", "moved out"],
  lockTimeoutMs: 30000,
  configCells: {
    inviteLink: "B1"
  },
  responseHeaders: [
    "Timestamp",
    "Email address",
    "Full Name",
    "Room Number",
    "Phone Number",
    "Status",
    "ApprovedBy",
    "Nameplate / postbox upload",
    "Consent",
    "InviteLink",
    "LeftAt",
    "ApprovedAt",
    "ReviewNotes"
  ],
  logHeaders: [
    "Timestamp",
    "Name",
    "Room",
    "Phone",
    "Status",
    "User",
    "Action",
    "Details"
  ]
};
