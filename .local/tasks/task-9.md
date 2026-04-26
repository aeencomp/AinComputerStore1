---
title: Staff advances + shift lock
---
# Staff Advance Payments + Shift Lock

## What & Why

**Feature 3 — Staff advance payments (دفع من الجيب):**
When a staff member pays out of their own pocket to cover a customer's balance gap, the store owes that money back to the employee. The amount must appear in the shift report as a positive contribution to the grand total (the business effectively received the value, funded by the employee).

Example: Customer's bill is 25, register has only 10, so Bakar pays 15 from his pocket. The store now owes Bakar 15. That 15 must appear in the daily report under "موظف" advances and be added to — not subtracted from — the grand total.

**Feature 4 — Shift lock after close:**
Once a shift is ended, the shift's financial data must be frozen. No one should be able to add or delete cash withdrawals or staff advances that would retroactively change a closed shift's report.

## Done looks like

**Staff advances:**
- In SalesDashboard, a new "دفع من الجيب / Staff Advance" button/section allows recording: staff member name, amount, reason (optional).
- Staff advances appear in the shift report (DailyReport) as a separate table section, colored distinctly from withdrawals, with a running total.
- The total of staff advances is **added** to the grand total and net total in both the UI summary and printed receipt.

**Shift lock:**
- Attempting to add a new cash withdrawal or staff advance when there is no active shift fails with a clear Arabic error message ("لا توجد وردية نشطة").
- Attempting to delete a cash withdrawal or staff advance that belongs to a **closed** shift fails with a clear error ("الوردية مغلقة، لا يمكن التعديل").
- The UI (SalesDashboard) hides the add-withdrawal and add-advance buttons when there is no active shift, making the lock visible to the user before they try.

## Out of scope
- Editing/partial repayment of advances (just add or void the whole record).
- Per-employee withdrawal attribution (cashWithdrawals still has no salesUserId).
- Advances affecting repair-ticket revenue or online orders.

## Tasks

1. **Schema & migration** — Add a `staff_advances` table (serial id, decimal amount, text staffName, text reason nullable, timestamp createdAt). Run `npm run db:push` to apply.

2. **Backend routes** — Add `GET /api/instore/staff-advances`, `POST /api/instore/staff-advances`, and `DELETE /api/instore/staff-advances/:id`. For POST: reject if no active shift exists for the session user. For DELETE: reject if the record's createdAt falls inside a closed shift's time window. Apply the same active-shift guard to the existing `POST /api/instore/withdrawals` and `DELETE /api/instore/withdrawals/:id` routes.

3. **computeShiftReport update** — Fetch staff advances in the same time window (optionally scoped by salesUserId if the column is added). Add `advancesTotal`, `advancesCount`, and `advances` array to the returned report data. Include `advancesTotal` in the `grandTotal` and `netTotal` calculations (added, not subtracted).

4. **SalesDashboard UI** — Add a "دفع من الجيب" collapsible section alongside the existing withdrawals panel. Show the list of advances for the active shift, an add-advance form (amount, staff name, reason), and a delete button per row. Hide the add buttons for both withdrawals and advances when no active shift exists.

5. **DailyReport UI & print** — Add a staff advances section to the shift report display (similar to the existing withdrawals table). Update the summary cards and net-total row to reflect `advancesTotal` as a positive contributor. Update the print/receipt HTML template to include the advances table and correct totals.

## Relevant files
- `shared/schema.ts`
- `server/routes.ts:1243-1430,6468-6540`
- `client/src/pages/SalesDashboard.tsx`
- `client/src/pages/DailyReport.tsx`