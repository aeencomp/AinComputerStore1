# Technician Dashboard — Dates on Cards + Sort by Date

## Objective
Improve the technician dashboard by showing intake/delivery dates on each ticket card and adding a sort-by-date control.

## Files to Change
- `client/src/pages/technician/TechnicianDashboard.tsx`

## Tasks

### T001: Add intake & delivery dates to ticket cards + sort by date
- **Blocked By**: []
- **Details**:
  1. Add `sortOrder` state: `'newest' | 'oldest'` (default: `'newest'`)
  2. Add a sort Select dropdown next to the existing status/priority filters:
     - "الأحدث أولاً / Newest First"
     - "الأقدم أولاً / Oldest First"
  3. Apply sort to `filteredTickets` using `ticket.createdAt`
  4. In each ticket card (CardContent), add two clearly labeled date rows:
     - **تاريخ الاستلام / Intake Date** — always shown, formatted `dd/MM/yyyy`
     - **تاريخ التسليم / Delivery Date** — shown always; if `ticket.deliveredAt` is set show the date, otherwise show "لم يُسلَّم / Not yet"
  5. Use `format` from `date-fns` (already imported)
- **Acceptance**: Each card shows both labeled dates; sort dropdown reorders cards by intake date.
