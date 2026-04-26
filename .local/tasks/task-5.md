---
title: Fix intercom auth rejection (No other users online)
---
# Fix Intercom Auth Rejection

## What & Why
The intercom widget always shows "No other users online" because WebSocket connections to `/ws/intercom` are being rejected at the authentication step. Server logs confirm this — there are zero "Intercom: connected" log messages despite users being logged in.

The cause: `server/intercom.ts` uses a custom HMAC-SHA256 cookie signature verifier (`unsignCookie`) that produces a mismatch against the actual session cookie format, so every connection is rejected with 401. The working `/ws/admin` and `/ws/sales` servers in `server/admin-notifications.ts` use a simpler `parseSessionId` function (strips `s:` prefix, takes everything before the last dot) — which works correctly.

## Done looks like
- When two portal users are logged in (e.g. Admin + Technician), each portal's intercom widget shows the other user in the online list with a count badge
- Server logs show "Intercom: portal/Name connected (peerId)" lines when portals connect
- Calls can be initiated between portals

## Out of scope
- Any changes to the call flow, WebRTC logic, or widget UI

## Tasks
1. **Fix session cookie parsing** — In `server/intercom.ts`, replace the `unsignCookie` function and its usage in `verifyClient` with the same `parseSessionId` approach used in `server/admin-notifications.ts`. Remove the now-unused `createHmac` import from the crypto import line.

## Relevant files
- `server/intercom.ts:25-67`
- `server/admin-notifications.ts:32-44`