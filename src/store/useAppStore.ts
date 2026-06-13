import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // 主题
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;

  // 未读通知数
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  incrementUnread: () => void;
  clearUnread: () => void;

  // 侧边栏折叠（桌面端）
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // 今日打卡状态
  todayCheckedIn: boolean;
  setTodayCheckedIn: (v: boolean) => void;

  // 当前连续打卡天数
  streakDays: number;
  setStreakDays: (n: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (t) => set({ theme: t }),

      unreadCount: 0,
      setUnreadCount: (n) => set({ unreadCount: n }),
      incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
      clearUnread: () => set({ unreadCount: 0 }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      todayCheckedIn: false,
      setTodayCheckedIn: (v) => set({ todayCheckedIn: v }),

      streakDays: 0,
      setStreakDays: (n) => set({ streakDays: n }),
    }),
    {
      name: 'zhixueban-app-store',
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        todayCheckedIn: s.todayCheckedIn,
        streakDays: s.streakDays,
      }),
    }
  )
);
