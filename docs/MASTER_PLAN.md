# FDH Guard Master Plan

## Goal

Build a robust, auditable, low-cost resident onboarding system using Google Forms, Google Sheets, Google Apps Script, and WhatsApp's manual "Approve new members" flow.

The system must be simple enough for student representatives to maintain, but strict enough to avoid accidental approvals, race conditions, silent email failures, and data drift.

## Architecture Decision

Use one spreadsheet-bound Apps Script project.

The form submit trigger must be installed from the response spreadsheet, not from the form. A spreadsheet-bound form submit event gives the script `e.range`, `e.values`, and `e.namedValues`, so the script can update the exact submitted row without relying on `getLastRow()` or sleeping for form propagation.

Rejected alternatives:

- Form-bound submit script: workable, but easier to misconfigure and does not receive the response sheet row directly.
- `SpreadsheetApp.getActiveSpreadsheet()` from a form-bound script: unreliable because a form-bound project has no active spreadsheet context.
- `sheet.getLastRow()` after `Utilities.sleep()`: race-prone if two submissions arrive close together.

## Data Model

### `Form_Responses`

Managed columns:

| Column | Field |
|---|---|
| A | Timestamp |
| B | Email address |
| C | Full Name |
| D | Room Number |
| E | Phone Number |
| F | Status |
| G | ApprovedBy |
| H | Nameplate / postbox upload |
| I | Consent |
| J | InviteLink |
| K | LeftAt |
| L | ApprovedAt |
| M | ReviewNotes |

Allowed statuses:

- `pending`
- `approved`
- `rejected`
- `moved out`

### Admin/config sheets

- `Config!B1`: current WhatsApp invite link.
- `DataVerifiers!A2:A`: people allowed to verify submissions.
- `WAAdmins!A2:A`: WhatsApp group admins who receive approval notifications.
- `TechnicalAdmins!A2:A`: optional failure recipients. If empty/missing, failures fall back to DataVerifiers.
- `Log`: append-only audit trail.
- `Dashboard`: generated counts and last update timestamp.

## Workflow

### New form submission

1. `handleFormSubmit(e)` runs from the spreadsheet-bound installable trigger.
2. The handler uses `e.range.getRow()` to update the exact submitted row.
3. Status is set to `pending`.
4. Required fields are checked.
5. Room number is normalized for comparison.
6. Existing approved residents in the same room are detected and included in review notes.
7. Existing residents are not moved out yet. Move-out happens only after the new resident is approved.
8. DataVerifiers receive an email with the submission and any warnings.
9. A log row is appended and the dashboard is updated.

### Manual approval

1. A verifier changes `Status` to `approved`.
2. `handleStatusEdit(e)` confirms the action with a dialog.
3. Required fields and invite link are validated.
4. `ApprovedBy`, `ApprovedAt`, and `InviteLink` are filled.
5. Other approved residents in the same normalized room are marked `moved out` and receive `LeftAt`.
6. Tenant receives the invite email.
7. WhatsApp admins receive the approval notification.
8. Audit log and dashboard are updated.

### Manual rejection

1. A verifier changes `Status` to `rejected`.
2. The action is confirmed.
3. Review notes, audit log, and dashboard are updated.
4. No tenant email is sent by default until the group decides on rejection wording.

### Manual move-out

1. A verifier changes `Status` to `moved out`.
2. The action is confirmed.
3. `LeftAt` is filled if empty.
4. Audit log and dashboard are updated.

## Hardening Checklist

- Use `LockService` for submit and approval handlers.
- Avoid `lastRow` matching for live submissions.
- Make setup functions idempotent.
- Apply status validation to all future response rows.
- Add conditional formatting for status rows.
- Log every workflow action.
- Send failure notifications to `TechnicalAdmins` or `DataVerifiers`.
- Never silently approve when required fields or invite link are missing.
- Do not auto-move existing approved residents on a new unverified submission.
- Keep all source in git and push to Apps Script through clasp.

## Versioning Workflow

1. Local development happens in this git repository.
2. Apps Script source lives in `src/`.
3. `clasp` pushes `src/` to the Google Apps Script project.
4. Every meaningful change should be committed before pushing to Apps Script.
5. Use tags for stable production versions, for example `v1.0.0`.

Recommended release sequence:

```powershell
npm run validate
npm run clasp:push
git add .
git commit -m "Implement spreadsheet-bound FDH Guard automation"
git push origin main
```

## Deployment Steps

1. Open the Apps Script project and copy its script ID from Project Settings.
2. Copy `.clasp.json.example` to `.clasp.json`.
3. Replace `PASTE_SCRIPT_ID_HERE` with the script ID.
4. Run `npm run clasp:login` if this machine is not already authenticated.
5. Run `npm run clasp:push`.
6. Reload the Google Sheet.
7. Use `FDH Guard > Run initial setup`.
8. Use `FDH Guard > Install triggers`.
9. Submit a test form entry.
10. Approve the test row and verify tenant/admin emails, audit log, and dashboard.

## Future Improvements

- Add a controlled resend flow for tenant and WhatsApp admin emails.
- Add stricter protected ranges once real maintainer accounts are finalized.
- Add optional tenant rejection email templates.
- Add retention policy for uploaded verification photos.
- Add a separate `Residents` registry if the form response sheet becomes too noisy for long-term operations.
