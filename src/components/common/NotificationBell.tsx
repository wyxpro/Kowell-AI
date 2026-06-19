import { useState, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

interface Notification {
  id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    const fetchNotifs = async () => {
      const { data: resources } = await supabase
        .from('resources')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'generating')
        .order('created_at', { ascending: false });

      const mockNotifs: Notification[] = [
        { id: '1', title: '欢迎使用 Kowell AI', content: '开始构建你的学习画像，获取个性化学习体验', is_read: false, created_at: new Date().toISOString() },
      ];

      if (Array.isArray(resources) && resources.length > 0) {
        mockNotifs.push({
          id: 'gen-1',
          title: '资源生成提醒',
          content: `有 ${resources.length} 个资源正在生成中`,
          is_read: false,
          created_at: resources[0].created_at,
        });
      }

      setNotifications(mockNotifs);
    };
    fetchNotifs();
  }, [user]);

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-medium">通知</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-primary"
              onClick={markAllRead}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              一键已阅
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">暂无通知</div>
          ) : (
            [...notifications]
              .sort((a, b) => Number(a.is_read) - Number(b.is_read))
              .map(n => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={`w-full text-left p-3 border-b border-border last:border-0 transition-colors hover:bg-muted/50 ${
                  n.is_read ? 'opacity-50' : 'bg-primary/5'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  <div className={!n.is_read ? '' : 'pl-3.5'}>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 text-pretty">{n.content}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        {notifications.length > 0 && unreadCount === 0 && (
          <div className="p-2 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">所有通知已阅</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

