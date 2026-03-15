import { useState } from 'react';
import { useIntercom, type OnlineUser } from '@/hooks/useIntercom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, PhoneIncoming, PhoneCall, Mic, MicOff, X, Users } from 'lucide-react';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function portalLabel(portal: string, lang: string): string {
  const labels: Record<string, Record<string, string>> = {
    admin: { ar: 'مدير', en: 'Admin' },
    sales: { ar: 'مبيعات', en: 'Sales' },
    technician: { ar: 'فني', en: 'Technician' },
  };
  return labels[portal]?.[lang] || portal;
}

function portalColor(portal: string): string {
  switch (portal) {
    case 'admin': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
    case 'sales': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
    case 'technician': return 'bg-green-500/10 text-green-700 dark:text-green-400';
    default: return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
  }
}

export function IntercomWidget() {
  const { language } = useLanguage();
  const {
    onlineUsers,
    callState,
    caller,
    isMuted,
    myPeerId,
    callDuration,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
  } = useIntercom();
  const [expanded, setExpanded] = useState(false);

  const otherUsers = onlineUsers.filter(u => u.peerId !== myPeerId);
  const onlineCount = otherUsers.length;

  if (callState === 'ringing-in' && caller) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4" data-testid="intercom-incoming-call">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <PhoneIncoming className="h-8 w-8 text-green-500 animate-pulse" />
            </div>
            <div>
              <p className="text-lg font-bold">{caller.displayName}</p>
              <Badge className={`${portalColor(caller.portal)} mt-1`}>
                {portalLabel(caller.portal, language)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'مكالمة واردة...' : 'Incoming call...'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={declineCall}
                variant="outline"
                className="bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/40"
                data-testid="button-decline-call"
              >
                <PhoneOff className="h-4 w-4 me-2" />
                {language === 'ar' ? 'رفض' : 'Decline'}
              </Button>
              <Button
                onClick={acceptCall}
                className="bg-green-600 text-white"
                data-testid="button-accept-call"
              >
                <Phone className="h-4 w-4 me-2" />
                {language === 'ar' ? 'قبول' : 'Accept'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (callState === 'ringing-out' && caller) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]" data-testid="intercom-ringing-out">
        <Card className="w-72">
          <CardContent className="pt-4 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <PhoneCall className="h-6 w-6 text-blue-500 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold">{caller.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'جاري الاتصال...' : 'Calling...'}
              </p>
            </div>
            <Button
              onClick={endCall}
              variant="outline"
              size="sm"
              className="bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/40"
              data-testid="button-cancel-call"
            >
              <PhoneOff className="h-4 w-4 me-2" />
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (callState === 'in-call' && caller) {
    return (
      <div className="fixed bottom-6 right-6 z-[9999]" data-testid="intercom-in-call">
        <Card className="w-72">
          <CardContent className="pt-4 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <PhoneCall className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="font-semibold">{caller.displayName}</p>
              <Badge className={`${portalColor(caller.portal)} mt-1`}>
                {portalLabel(caller.portal, language)}
              </Badge>
              <p className="text-sm font-mono text-muted-foreground mt-1" data-testid="text-call-duration">
                {formatDuration(callDuration)}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={toggleMute}
                variant="outline"
                size="icon"
                className={isMuted ? 'bg-yellow-500/10 text-yellow-600' : ''}
                data-testid="button-toggle-mute"
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                onClick={endCall}
                variant="outline"
                className="bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/40"
                data-testid="button-end-call"
              >
                <PhoneOff className="h-4 w-4 me-2" />
                {language === 'ar' ? 'إنهاء' : 'End'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999]" data-testid="intercom-widget">
      {expanded && (
        <Card className="w-72 mb-3">
          <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              {language === 'ar' ? 'الاتصال الداخلي' : 'Intercom'}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded(false)}
              data-testid="button-close-intercom"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {otherUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {language === 'ar' ? 'لا يوجد مستخدمون متصلون' : 'No other users online'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {otherUsers.map((user: OnlineUser) => (
                  <div
                    key={user.peerId}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate"
                    data-testid={`intercom-user-${user.peerId}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.displayName}</p>
                        <Badge variant="outline" className={`text-[10px] ${portalColor(user.portal)}`}>
                          {portalLabel(user.portal, language)}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { initiateCall(user.peerId); setExpanded(false); }}
                      data-testid={`button-call-${user.peerId}`}
                    >
                      <Phone className="h-4 w-4 text-green-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg relative"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-intercom-toggle"
      >
        <Phone className="h-5 w-5" />
        {onlineCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">
            {onlineCount}
          </span>
        )}
      </Button>
    </div>
  );
}
