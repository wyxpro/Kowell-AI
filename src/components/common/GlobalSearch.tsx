import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, FileText, BookOpen, MessageSquare, X, ArrowRight } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  type: 'resource' | 'course' | 'post';
  subtitle: string;
}

export default function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const [resources, courses, posts] = await Promise.all([
      supabase.from('resources').select('id, title, description').ilike('title', `%${q}%`).limit(5),
      supabase.from('courses').select('id, name, description').ilike('name', `%${q}%`).limit(5),
      supabase.from('community_posts').select('id, title, content').ilike('title', `%${q}%`).limit(5),
    ]);

    const res: SearchResult[] = [];
    (resources.data || []).forEach((r: any) => res.push({ id: r.id, title: r.title, type: 'resource', subtitle: r.description || '' }));
    (courses.data || []).forEach((c: any) => res.push({ id: c.id, title: c.name, type: 'course', subtitle: c.description || '' }));
    (posts.data || []).forEach((p: any) => res.push({ id: p.id, title: p.title || '无标题', type: 'post', subtitle: p.content?.slice(0, 60) + '...' || '' }));

    setResults(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleSelect = (r: SearchResult) => {
    onOpenChange(false);
    if (r.type === 'resource') navigate(`/resources/${r.id}`);
    if (r.type === 'course') navigate('/resources');
    if (r.type === 'post') navigate('/community');
  };

  const typeIcon = {
    resource: <FileText className="w-4 h-4 text-primary" />,
    course: <BookOpen className="w-4 h-4 text-secondary" />,
    post: <MessageSquare className="w-4 h-4 text-sky-500" />,
  };

  const typeLabel = {
    resource: '资源',
    course: '课程',
    post: '帖子',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="sr-only">全局搜索</DialogTitle>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="搜索资源、课程、帖子..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0"
              autoFocus
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="shrink-0">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && query.trim() && (
            <div className="text-center py-4 text-sm text-muted-foreground">搜索中...</div>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <div className="text-center py-4 text-sm text-muted-foreground">未找到结果</div>
          )}
          {results.length > 0 && (
            <div className="space-y-1">
              {results.map(r => (
                <button
                  key={`${r.type}-${r.id}`}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {typeIcon[r.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{r.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{typeLabel[r.type]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}