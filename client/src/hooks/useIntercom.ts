import { useState, useEffect, useRef, useCallback } from 'react';

export interface OnlineUser {
  peerId: string;
  displayName: string;
  portal: 'admin' | 'sales' | 'technician';
}

export type CallState = 'idle' | 'ringing-out' | 'ringing-in' | 'in-call';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useIntercom() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [callState, setCallState] = useState<CallState>('idle');
  const [caller, setCaller] = useState<{ peerId: string; displayName: string; portal: string } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const activePeerRef = useRef<string | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const ringingTimeoutRef = useRef<number | null>(null);

  const send = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const setCallStateSync = useCallback((state: CallState) => {
    callStateRef.current = state;
    setCallState(state);
  }, []);

  const cleanup = useCallback(() => {
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    activePeerRef.current = null;
    setCallStateSync('idle');
    setCaller(null);
    setIsMuted(false);
    setCallDuration(0);
  }, [setCallStateSync]);

  const startCallTimer = useCallback(() => {
    setCallDuration(0);
    callTimerRef.current = window.setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const createPeerConnection = useCallback((targetId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({ type: 'ice-candidate', targetId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      remoteAudioRef.current.srcObject = e.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        send({ type: 'call-end', targetId });
        cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [send, cleanup]);

  const getLocalStream = useCallback(async () => {
    if (!localStreamRef.current) {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    return localStreamRef.current;
  }, []);

  const initiateCall = useCallback(async (targetId: string) => {
    if (callStateRef.current !== 'idle') return;
    activePeerRef.current = targetId;
    const targetUser = onlineUsers.find(u => u.peerId === targetId);
    setCaller(targetUser || null);
    setCallStateSync('ringing-out');
    send({ type: 'call-request', targetId });
    ringingTimeoutRef.current = window.setTimeout(() => {
      if (callStateRef.current === 'ringing-out') {
        send({ type: 'call-end', targetId });
        cleanup();
      }
    }, 30000);
  }, [onlineUsers, send, setCallStateSync, cleanup]);

  const acceptCall = useCallback(async () => {
    if (callStateRef.current !== 'ringing-in' || !caller) return;
    const targetId = caller.peerId;
    activePeerRef.current = targetId;

    try {
      const stream = await getLocalStream();
      const pc = createPeerConnection(targetId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      send({ type: 'call-accept', targetId });
    } catch (err) {
      console.error('Intercom: failed to get audio', err);
      send({ type: 'call-decline', targetId });
      cleanup();
    }
  }, [caller, send, getLocalStream, createPeerConnection, cleanup]);

  const declineCall = useCallback(() => {
    if (caller) {
      send({ type: 'call-decline', targetId: caller.peerId });
    }
    cleanup();
  }, [caller, send, cleanup]);

  const endCall = useCallback(() => {
    if (activePeerRef.current) {
      send({ type: 'call-end', targetId: activePeerRef.current });
    }
    cleanup();
  }, [send, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      if (!mounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/intercom`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Intercom WS connected');
        setWsConnected(true);
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'welcome':
              setMyPeerId(msg.peerId);
              break;

            case 'presence':
              setOnlineUsers(msg.users);
              break;

            case 'call-request':
              if (callStateRef.current === 'idle') {
                setCaller({ peerId: msg.fromPeerId, displayName: msg.fromName, portal: msg.fromPortal });
                setCallStateSync('ringing-in');
              } else {
                send({ type: 'call-decline', targetId: msg.fromPeerId });
              }
              break;

            case 'call-accept': {
              if (callStateRef.current !== 'ringing-out') break;
              try {
                const stream = await getLocalStream();
                const pc = createPeerConnection(msg.fromPeerId);
                stream.getTracks().forEach(t => pc.addTrack(t, stream));
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                send({ type: 'offer', targetId: msg.fromPeerId, sdp: offer });
                setCallStateSync('in-call');
                startCallTimer();
              } catch (err) {
                console.error('Intercom: offer creation failed', err);
                cleanup();
              }
              break;
            }

            case 'call-decline':
              cleanup();
              break;

            case 'offer': {
              if (!pcRef.current) break;
              const pc = pcRef.current;
              await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              send({ type: 'answer', targetId: msg.fromPeerId, sdp: answer });
              setCallStateSync('in-call');
              startCallTimer();
              break;
            }

            case 'answer': {
              if (!pcRef.current) break;
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
              break;
            }

            case 'ice-candidate': {
              if (pcRef.current && msg.candidate) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } catch (e) {
                  console.warn('Intercom: ICE candidate error', e);
                }
              }
              break;
            }

            case 'call-end':
              cleanup();
              break;
          }
        } catch (err) {
          console.error('Intercom: message parse error', err);
        }
      };

      ws.onclose = (e) => {
        console.log('Intercom WS disconnected, code:', e.code, 'reason:', e.reason);
        setWsConnected(false);
        setOnlineUsers([]);
        setMyPeerId(null);
        if (mounted) {
          reconnectRef.current = window.setTimeout(connect, 5000);
        }
      };

      ws.onerror = (err) => {
        console.error('Intercom WS error:', err);
      };
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
      cleanup();
    };
  }, []);

  return {
    onlineUsers,
    callState,
    caller,
    isMuted,
    myPeerId,
    callDuration,
    wsConnected,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
  };
}
