---
title: Voice intercom between portal users
---
# Voice Intercom Between Portal Users

  ## What & Why
  Add a browser-based push-to-talk / voice call intercom so Admin, Sales, and Technician portal users can call each other by voice directly in the browser. No third-party service — runs over WebRTC with the existing server handling signaling. Useful for quick coordination between the shop floor, sales counter, and repair room.

  ## Done looks like
  - A floating intercom button appears in the bottom-right corner of the Admin, Sales, and Technician dashboards
  - Clicking it opens a panel showing which other portal users are currently online
  - Any user can tap another user's name to initiate a voice call
  - The called user sees an incoming call notification (name + Accept / Decline)
  - Once both sides accept, audio streams live between them
  - An in-call HUD shows the caller name, a running timer, a Mute toggle, and an End Call button
  - Closing or navigating away automatically removes the user from the online list within seconds

  ## Out of scope
  - Video calls
  - Group calls (one-to-one only)
  - Call history / logging
  - Push notifications when the browser tab is closed
  - TURN server (LAN / same-network usage only; public STUN server used)

  ## Tasks
  1. **Intercom signaling server** — Create `server/intercom.ts` with a WebSocket server on `/ws/intercom` that authenticates all portal types (admin, sales, technician) from their session cookie, assigns each connection a peer ID, maintains a presence map, broadcasts presence updates on join/leave, and relays WebRTC signaling messages (call-request, call-accept, call-decline, offer, answer, ice-candidate, call-end) between specific peers. Initialize it in `server/app.ts`.

  2. **Intercom React hook** — Create `client/src/hooks/useIntercom.ts` that connects to `/ws/intercom`, manages `onlineUsers` state, manages call state machine (idle → ringing-out / ringing-in → in-call → idle), holds the RTCPeerConnection and audio stream refs, and exposes `initiateCall`, `acceptCall`, `declineCall`, `endCall`, `toggleMute`.

  3. **Intercom widget UI** — Create `client/src/components/IntercomWidget.tsx` as a floating widget: collapsed state is a single button with an online-user count badge; expanded state lists online users with portal badges and a call button; a full-screen overlay handles incoming call (Accept/Decline) and in-call (Mute/End) states. Mount the widget inside the Admin, Sales, and Technician portal pages.

  ## Relevant files
  - `server/admin-notifications.ts`
  - `server/app.ts`
  - `client/src/hooks/useAdminNotifications.ts`
  - `client/src/pages/AdminDashboard.tsx`
  - `client/src/pages/SalesPortal.tsx`
  - `client/src/pages/technician/TechnicianDashboard.tsx`