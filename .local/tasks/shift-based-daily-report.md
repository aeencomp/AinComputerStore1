# Shift-Based Daily Report

## What & Why
Currently the daily report is grouped by calendar day (midnight to midnight).
Any sales made after midnight belong to the "next day" even if the employee
is still on the same shift. The user wants the report to follow the shift
instead: when an employee closes their shift, that is the daily report for
that working period — regardless of whether the shift crosses midnight.

## Done looks like
- The Daily Report page shows a list of closed shifts (employee name, start
  time, end time, total) instead of a date picker
- Sales users see only their own closed shifts; admin sees shifts from all
  employees
- Clicking a shift loads the full report for that shift's time range:
  all instore orders, repair ticket payments, and cash withdrawals that
  occurred between the shift's `startTime` and `endTime`
- An active (open) shift shows a live "current shift" snapshot at the top
  that updates in real time, showing sales so far during this shift
- The shift-close confirmation dialog now shows a summary preview (total
  sales during the shift across all payment methods)
- The report printout labels the period as the shift time range instead
  of a calendar date
- Admin portal daily report also switches to the shift-based selector

## Out of scope
- Storing a frozen snapshot in the database at shift-close time (reports are
  computed on demand from the time range)
- Changing the shift open/close UI beyond adding the summary preview
- Removing the existing `/api/daily-report` endpoint (kept for any
  backward-compatible callers)

## Tasks
1. **New shift report API** — Add `GET /api/sales/shifts` endpoint (lists
   closed shifts; filters to own shifts for sales users, all shifts for
   admin). Add `GET /api/sales/shifts/:id/report` endpoint that runs the
   same aggregation logic as the existing daily-report but uses the shift's
   `startTime` / `endTime` as the time range. Also add a
   `GET /api/sales/shifts/active-snapshot` that returns the live summary for
   the currently open shift (or null).

2. **Update shift-close to calculate all payment methods** — The current
   `POST /api/sales/shifts/end` only tracks cash orders. Update it to
   calculate and store the total across all payment methods (cash, zaincash,
   qicard, deferred) for instore orders, plus repair ticket revenues during
   the shift. This gives an accurate `totalSales` and updated
   `expectedCash` at close time.

3. **Daily Report UI — shift selector** — Replace the date picker in
   `DailyReport.tsx` with a shift selector panel on the left: list of
   closed shifts with employee name, formatted time range, and grand total.
   Clicking a shift calls `/api/sales/shifts/:id/report` and renders the
   existing report layout. Show the live active-shift snapshot at the top
   of the list if a shift is currently open. Update the printout header to
   show the shift time range instead of a calendar date.

## Relevant files
- `server/routes.ts:1085-1201`
- `server/routes.ts:6324-6442`
- `client/src/pages/DailyReport.tsx`
- `client/src/pages/SalesDashboard.tsx`
- `shared/schema.ts:548-571`
