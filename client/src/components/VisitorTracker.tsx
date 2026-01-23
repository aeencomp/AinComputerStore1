import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

function generateSessionId(): string {
  const stored = sessionStorage.getItem('visitorSessionId');
  if (stored) return stored;
  
  const newId = `vs_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  sessionStorage.setItem('visitorSessionId', newId);
  return newId;
}

export function VisitorTracker() {
  const [location] = useLocation();
  const sessionId = useRef(generateSessionId());
  const startTime = useRef(Date.now());
  const lastPageTime = useRef(Date.now());
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initSession = async () => {
      try {
        await fetch('/api/analytics/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId.current,
            landingPage: window.location.pathname,
            referrer: document.referrer || '',
            userAgent: navigator.userAgent,
          }),
        });
      } catch (error) {
        // Silently fail
      }
    };

    initSession();

    const heartbeatInterval = setInterval(async () => {
      const duration = Math.floor((Date.now() - startTime.current) / 1000);
      try {
        await fetch('/api/analytics/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId.current,
            duration,
          }),
        });
      } catch (error) {
        // Silently fail
      }
    }, 30000);

    const handleBeforeUnload = () => {
      const duration = Math.floor((Date.now() - startTime.current) / 1000);
      navigator.sendBeacon('/api/analytics/end-session', JSON.stringify({
        sessionId: sessionId.current,
        duration,
      }));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const timeOnPrevPage = Math.floor((Date.now() - lastPageTime.current) / 1000);
    lastPageTime.current = Date.now();

    const recordPageView = async () => {
      try {
        await fetch('/api/analytics/pageview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sessionId.current,
            pagePath: location,
            pageTitle: document.title,
            timeOnPage: timeOnPrevPage,
          }),
        });
      } catch (error) {
        // Silently fail
      }
    };

    if (initialized.current) {
      recordPageView();
    }
  }, [location]);

  return null;
}