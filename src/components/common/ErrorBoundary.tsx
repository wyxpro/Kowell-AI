import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const RELOAD_KEY = 'vite_chunk_reload_count';
const MAX_RELOADS = 3;

interface State { hasError: boolean; error?: Error; reloading: boolean }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, reloading: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError = error?.message?.includes('Failed to fetch dynamically imported module');
    return { hasError: true, error, reloading: isChunkError };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);

    // 动态模块加载失败（Vite dep hash 过期）→ 有限次数硬刷新
    if (error?.message?.includes('Failed to fetch dynamically imported module')) {
      const count = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
      if (count < MAX_RELOADS) {
        sessionStorage.setItem(RELOAD_KEY, String(count + 1));
        window.location.reload();
      } else {
        // 超过重试上限，清除计数，展示错误界面
        sessionStorage.removeItem(RELOAD_KEY);
        this.setState({ reloading: false });
      }
    }
  }

  render() {
    if (this.state.reloading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center gap-4">
          <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">正在刷新页面，请稍候...</p>
        </div>
      );
    }
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">页面出现错误</h2>
          <p className="text-sm text-muted-foreground max-w-sm text-pretty">
            {this.state.error?.message || '发生了未知错误，请刷新页面重试'}
          </p>
          <Button
            onClick={() => {
              sessionStorage.removeItem(RELOAD_KEY);
              this.setState({ hasError: false, reloading: false });
            }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
