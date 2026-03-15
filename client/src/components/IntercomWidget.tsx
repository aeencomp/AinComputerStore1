import { useState, useRef, useEffect } from 'react';
import { useIntercom, type OnlineUser, type ChatMessage } from '@/hooks/useIntercom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, PhoneIncoming, PhoneCall, Mic, MicOff, X, Users, MessageSquare, Send } from 'lucide-react';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

interface IntercomWidgetProps {
  portal: 'admin' | 'sales' | 'technician';
}

export function IntercomWidget({ portal }: IntercomWidgetProps) {
  const { language } = useLanguage();
  const {
    onlineUsers,
    callState,
    caller,
    isMuted,
    callDuration,
    wsConnected,
    chatMessages,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    sendChatMessage,
  } = useIntercom(portal);

  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'chat'>('users');
  const [chatInput, setChatInput] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const prevMsgCount = useRef(0);

  const otherUsers = onlineUsers;
  const onlineCount = otherUsers.length;

  useEffect(() => {
    if (chatMessages.length > prevMsgCount.current) {
      const newMsgs = chatMessages.slice(prevMsgCount.current);
      const hasOtherMsg = newMsgs.some(m => !m.isMine);
      if (hasOtherMsg && (!expanded || activeTab !== 'chat')) {
        setUnreadCount(prev => prev + newMsgs.filter(m => !m.isMine).length);
      }
    }
    prevMsgCount.current = chatMessages.length;
  }, [chatMessages, expanded, activeTab]);

  useEffect(() => {
    if (expanded && activeTab === 'chat') {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [expanded, activeTab, chatMessages]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput);
    setChatInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
        <Card className="w-80 mb-3 flex flex-col" style={{ maxHeight: '420px' }}>
          <CardHeader className="pb-0 pt-3 px-4 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
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
            </div>

            <div className="flex gap-1 mt-2 border-b">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${activeTab === 'users' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
                onClick={() => setActiveTab('users')}
                data-testid="tab-intercom-users"
              >
                <Users className="h-3.5 w-3.5" />
                {language === 'ar' ? 'المتصلون' : 'Online'}
                {onlineCount > 0 && (
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[10px] font-bold">
                    {onlineCount}
                  </span>
                )}
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${activeTab === 'chat' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
                onClick={() => { setActiveTab('chat'); setUnreadCount(0); }}
                data-testid="tab-intercom-chat"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {language === 'ar' ? 'دردشة' : 'Chat'}
                {unreadCount > 0 && (
                  <span className="bg-green-500 text-white rounded-full px-1.5 py-0 text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-3 flex-1 overflow-hidden flex flex-col min-h-0">
            {activeTab === 'users' && (
              <div className="flex-1 overflow-y-auto pt-2">
                {!wsConnected ? (
                  <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-intercom-connecting">
                    {language === 'ar' ? 'جاري الاتصال...' : 'Connecting...'}
                  </p>
                ) : otherUsers.length === 0 ? (
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
              </div>
            )}

            {activeTab === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto py-2 space-y-2 min-h-0">
                  {chatMessages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {language === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet'}
                    </p>
                  ) : (
                    chatMessages.map((msg: ChatMessage) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-0.5 ${msg.isMine ? 'items-end' : 'items-start'}`}
                        data-testid={`chat-msg-${msg.id}`}
                      >
                        {!msg.isMine && (
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="text-[11px] font-medium text-foreground">{msg.fromName}</span>
                            <Badge variant="outline" className={`text-[9px] ${portalColor(msg.fromPortal)}`}>
                              {portalLabel(msg.fromPortal, language)}
                            </Badge>
                          </div>
                        )}
                        <div className={`max-w-[85%] px-3 py-1.5 rounded-lg text-sm ${msg.isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-muted-foreground px-1">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2 pt-2 shrink-0 border-t">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={language === 'ar' ? 'اكتب رسالة...' : 'Type a message...'}
                    className="flex-1 text-sm bg-muted rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-ring border-0"
                    data-testid="input-chat-message"
                    disabled={!wsConnected}
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!chatInput.trim() || !wsConnected}
                    data-testid="button-send-chat"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
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
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${wsConnected ? 'bg-green-500' : 'bg-gray-400'}`}
          data-testid="indicator-intercom-status"
        />
        {(onlineCount > 0 || unreadCount > 0) && (
          <span className={`absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${unreadCount > 0 ? 'bg-red-500' : 'bg-green-500'}`}>
            {unreadCount > 0 ? unreadCount : onlineCount}
          </span>
        )}
      </Button>
    </div>
  );
}
