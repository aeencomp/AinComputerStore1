# Fix Intercom WebSocket Not Connecting

## What & Why
Two portal users are open simultaneously (admin + technician) but both still show "لا يوجد مستخدمون متصلون". Server logs show `/ws/admin` and `/ws/sales` WebSocket connections authenticating successfully, but zero intercom messages appear, meaning `/ws/intercom` connections never reach the server.

The root cause is unknown because there is no diagnostic logging in `server/intercom.ts` verifyClient — all rejection paths (no cookie, bad session, unrecognized portal) call `callback(false)` silently. We need to find and fix the exact failure.

## Done looks like
- Server logs show "Intercom: admin/Name connected" and "Intercom: technician/Name connected" when two portals are open
- The online user count badge on the floating button shows the other user
- Each portal's intercom panel lists the other user by name with their portal badge

## Out of scope
- Any changes to the call flow, WebRTC logic, or widget UI

## Tasks

1. **Add verbose diagnostic logging to verifyClient** — In `server/intercom.ts`, add `console.log` before every `callback()` call in `verifyClient` so we can see exactly which step rejects connections. Also add a top-level log when a WS upgrade request arrives at the path. Run the server and check logs with two portals open.

2. **Fix the identified rejection cause** — Based on what the logs reveal, fix the actual failure. The most likely candidates are:
   - The `resolveSession` function querying the wrong table name or column for a portal type
   - A session that exists in the store but whose structure isn't matched by `if (session?.adminId)` etc.
   - The WS server path `/ws/intercom` not receiving upgrade requests (potentially an issue with multiple WebSocketServer instances sharing one HTTP server — in that case, switch to a single WS server with manual path routing instead of separate instances)

3. **Add connection status to the widget** — Show a small colored dot (green = connected, grey = connecting) next to the intercom button so the user can immediately see if the WS is up. Remove it after the feature is confirmed working.

## Relevant files
- `server/intercom.ts`
- `server/admin-notifications.ts` (reference for working pattern)
- `client/src/hooks/useIntercom.ts`
- `client/src/components/IntercomWidget.tsx`
