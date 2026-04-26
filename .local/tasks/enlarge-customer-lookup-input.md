# Enlarge search bar on Technician Dashboard

## What & Why
The search bar on the main Technician Dashboard (TechnicianDashboard.tsx) is too
small. Its width is artificially capped at 300px and uses the default (compact)
input size. Make it bigger so it's easier to use.

## Done looks like
- The container div around the search input no longer has `md:max-w-[300px]`;
  it grows to fill available space.
- The search `<Input>` has `text-base` added so the text inside is larger.
- The `<Search>` icon inside the input is scaled up from `h-4 w-4` to `h-5 w-5`,
  and the left padding on the input is adjusted to match (`ps-11`).
- No other inputs or controls on the page are affected.

## Relevant files
- `client/src/pages/technician/TechnicianDashboard.tsx` (~lines 393-403)
