# Fix Intercom: One-way Audio + Duplicate Online Users

## What & Why

Two bugs reported after intercom WS connection was fixed:

1. **One-way audio** — Only one participant hears the other during a call.
   Root cause: `ontrack` handler sets `autoplay = true` on an Audio element but
   never calls `.play()`. Browsers block autoplay without explicit user interaction,
   so audio silently fails on whichever side triggers the element creation without
   a click context. Also, `e.streams[0]` can be undefined in some browsers.

2. **Duplicate users in presence list** — Same person logged in on two tabs
   (e.g. admin portal open in two windows) appears twice in the intercom panel.
   Root cause: each tab creates a unique `peerId` and `broadcastPresence` lists
   every active connection, not every unique user.

## Done looks like

- Both participants can hear each other during a call
- A user logged in on 2+ browser tabs appears only once in the online users list
- Calling still works correctly (reaches the user even if they have multiple tabs)

## Out of scope
- Any UI changes beyond what's needed for the fixes
- Changes to the WebRTC negotiation flow

## Fix 1: One-way audio (`client/src/hooks/useIntercom.ts`)

In `createPeerConnection`, replace the `ontrack` handler:

```ts
// BAD — current code
pc.ontrack = (e) => {
  if (!remoteAudioRef.current) {
    remoteAudioRef.current = new Audio();
    remoteAudioRef.current.autoplay = true;
  }
  remoteAudioRef.current.srcObject = e.streams[0];
};

// GOOD — create MediaStream, add tracks, call play() explicitly
const remoteStream = new MediaStream();
pc.ontrack = (e) => {
  e.track && remoteStream.addTrack(e.track);
  if (!remoteAudioRef.current) {
    remoteAudioRef.current = new Audio();
    remoteAudioRef.current.srcObject = remoteStream;
  }
  remoteAudioRef.current.play().catch(() => {});
};
```

`remoteStream` must be created locally inside `createPeerConnection` so each
call gets its own stream. The `.play()` call is the critical addition — browsers
require it, and the `.catch(() => {})` silently handles any remaining policy
block without crashing.

Also in `cleanup()`, make sure the audio element is paused and cleared:
```ts
if (remoteAudioRef.current) {
  remoteAudioRef.current.pause();
  remoteAudioRef.current.srcObject = null;
  remoteAudioRef.current = null;
}
```

## Fix 2: Duplicate users (`server/intercom.ts`)

### Step 1 — Add `userId` to `IntercomClient` and `resolveSession`

Change `resolveSession` to also return the user's database ID:
```ts
interface IntercomClient {
  ...
  userId: string;   // add this
}

// resolveSession returns { displayName, portal, userId }
```

### Step 2 — Deduplicate in `broadcastPresence`

When building the presence list, deduplicate by `userId + portal`. Keep the
FIRST connected client's `peerId` so calling still works. Each unique user
appears once regardless of how many tabs they have open:

```ts
private broadcastPresence() {
  const seen = new Set<string>();
  const users: { peerId: string; displayName: string; portal: string }[] = [];
  for (const c of this.clients.values()) {
    const key = `${c.userId}:${c.portal}`;
    if (!seen.has(key)) {
      seen.add(key);
      users.push({ peerId: c.peerId, displayName: c.displayName, portal: c.portal });
    }
  }
  const message = JSON.stringify({ type: 'presence', users });
  this.clients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}
```

## Relevant files
- `client/src/hooks/useIntercom.ts` — ontrack handler + cleanup
- `server/intercom.ts` — resolveSession return type, IntercomClient interface, broadcastPresence deduplication
