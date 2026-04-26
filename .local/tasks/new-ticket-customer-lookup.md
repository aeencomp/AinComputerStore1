# New Ticket — Customer Auto-Fill by Phone or ID

## What & Why
When creating a new repair ticket, technicians currently have to type all customer
details by hand even for repeat customers. Adding a lookup field lets them type a
phone number or Customer ID (e.g. CUST-001) and auto-fill the customer's info.

## Done looks like
- At the top of the Customer Information section in the New Repair Request form,
  there is a lookup input labelled "ابحث عن عميل / Search customer".
- As the technician types (debounced 400ms), the app queries existing customers.
- If one match is found, a small inline card appears showing the customer name,
  Customer ID, and number of previous tickets.
- Clicking "Use this customer" (or the card auto-selects if it's an exact match)
  fills customerName, customerPhone, and customerEmail in the form below.
- A filled state shows a green indicator "✓ Returning customer — X previous tickets"
  and a small "Change" link to clear and search again.
- If no match, the fields remain blank and the technician fills them normally
  (creates a new customer as before).
- The lookup works for both phone number (partial or full, e.g. "07816") and
  Customer ID (e.g. "CUST-042" or just "042").

## Out of scope
- Editing customer details from this screen (that's the customer profile page).
- Any backend changes — existing /api/repair-customers?search= is sufficient.

## Tasks
1. Add `customerLookupQuery` state and debounced search using `/api/repair-customers?search=`.
2. Render lookup input + result card above the Customer Information fields.
3. On customer select, call `form.setValue` for name, phone, email and track the
   selected customer via `selectedCustomer` state.
4. Show the "returning customer" badge + previous-ticket count when auto-filled.
5. Add a "Change" button to clear `selectedCustomer` and reset the form fields.

## Relevant files
- `client/src/pages/technician/NewRepairRequest.tsx:720-800`
- `server/routes.ts:2538-2547`
