---
title: Enlarge search bars on Technician pages
---
# Enlarge search inputs on Technician pages

## What & Why
Two search inputs were too small. The user reported the search bar was small
and wanted it made bigger.

## Done looks like

### TechnicianDashboard.tsx (main dashboard search):
- Container no longer has `md:max-w-[300px]`; now `flex-1` filling available space.
- Input has `text-base` for larger font/height.
- `<Search>` icon scaled from `h-4 w-4` to `h-5 w-5`.
- Padding updated from `ps-10` to `ps-11`.

### NewRepairRequest.tsx (customer lookup input):
- `<Search>` icon scaled from `h-4 w-4` to `h-5 w-5`.
- Input class updated: `ltr:pl-9 rtl:pr-9` → `ltr:pl-11 rtl:pr-11 text-base`.
- Loading spinner scaled from `h-4 w-4` to `h-5 w-5`.

## Relevant files
- `client/src/pages/technician/TechnicianDashboard.tsx` (~lines 394-407)
- `client/src/pages/technician/NewRepairRequest.tsx` (~lines 774-790)
