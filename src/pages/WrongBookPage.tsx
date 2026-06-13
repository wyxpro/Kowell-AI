import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookMarked, CheckCircle2, Circle, Trash2, StickyNote, RefreshCw,
  Target, Brain, ChevronDown, ChevronUp, Lightbulb,
} from 'lucide-react';
import type { WrongBookEntry } from '@/types/types';

export default function WrongBookPage() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<WrongBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'mastered'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    fetchWrongBook();
  }, [profile]);

  const fetchWrongBook = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wrong_book')
      .select('*, exercises(id,question,options,answer,explanation,difficulty,category)')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false });
    const list = Array.isArray(data) ? data : [];
    setEntries(list);
    const initNotes: Record<string, string> = {};
    list.forEach(e => { initNotes[e.id] = e.note ?? ''; });
    setNoteMap(initNotes);
    setLoading(false);
  };

  const toggleMastered = async (entry: WrongBookEntry) => {
    const { error } = await supabase
      .from('wrong_book')
      .update({ mastered: !entry.mastered })
      .eq('id', entry.id);
    if (!error) {
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, mastered: !e.mastered } : e));
      toast.success(entry.mastered ? '已标记为未掌握' : '🎉 已标记为已掌握！');
    }
  };

  const saveNote = async (entryId: string) => {
    const { error } = await supabase
      .from('wrong_book')
      .update({ note: noteMap[entryId] || null })
      .eq('id', entryId);
    if (!error) {
      toast.success('笔记已保存');
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, note: noteMap[entryId] } : e));
    }
  };

  const removeEntry = async (entryId: string) => {
    const { error } = await supabase.from('wrong_book').delete().eq('id', entryId);
    if (!error) {
      setEntries(prev => prev.filter(e => e.id !== entryId));
      toast.success('已从错题本移除');
    }
  };

  const filtered = entries.filter(e => {
    if (tab === 'pending') return !e.mastered;
    if (tab === 'mastered') return e.mastered;
    return true;
  });

  const stats = {
    total: entries.length,
    pending: entries.filter(e => !e.mastered).length,
    mastered: entries.filter(e => e.mastered).length,
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <BookMarked className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-balance">错题本</h1>
              <p className="text-sm text-muted-foreground">巩固薄弱知识点</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchWrongBook} className="gap-1.5 shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </Button>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '总错题', value: stats.total, color: 'text-foreground', icon: Target },
            { label: '待掌握', value: stats.pending, color: 'text-destructive', icon: Circle },
            { label: '已掌握', value: stats.mastered, color: 'text-green-500', icon: CheckCircle2 },
          ].map(s => (
            <Card key={s.label} className="h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-5 h-5 shrink-0 ${s.color}`} />
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 题目列表 */}
        <Tabs value={tab} onValueChange={v => setTab(v as typeof tab)}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="all">全部 ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending">待掌握 ({stats.pending})</TabsTrigger>
            <TabsTrigger value="mastered">已掌握 ({stats.mastered})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-3">
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full bg-muted rounded-xl" />
            ))}
            {!loading && filtered.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    {tab === 'mastered' ? '还没有已掌握的题目' : '没有错题，继续加油！'}
                  </p>
                </CardContent>
              </Card>
            )}
            <AnimatePresence>
              {filtered.map((entry, i) => {
                const ex = entry.exercises;
                const isExpanded = expandedId === entry.id;
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className={`overflow-hidden border-l-4 ${entry.mastered ? 'border-l-green-500' : 'border-l-destructive'}`}>
                      <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              {ex?.difficulty && (
                                <Badge variant="outline" className="text-xs">
                                  {ex.difficulty === 'easy' ? '简单' : ex.difficulty === 'medium' ? '中等' : '困难'}
                                </Badge>
                              )}
                              {ex?.category && <Badge variant="secondary" className="text-xs">{ex.category}</Badge>}
                              {entry.mastered && <Badge className="text-xs bg-green-500/10 text-green-600 border-green-200 dark:border-green-800">已掌握</Badge>}
                            </div>
                            <p className="text-sm font-medium text-pretty line-clamp-2">{ex?.question ?? '题目已删除'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </CardHeader>

                      <AnimatePresence>
                        {isExpanded && ex && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <CardContent className="pt-0 px-4 pb-4 space-y-3">
                              {/* 选项 */}
                              {ex.options?.length > 0 && (
                                <div className="space-y-1.5">
                                  {ex.options.map((opt, idx) => (
                                    <div key={idx} className={`text-xs px-3 py-2 rounded-lg ${opt === ex.answer ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium' : 'bg-muted'}`}>
                                      {String.fromCharCode(65 + idx)}. {opt}
                                      {opt === ex.answer && ' ✓'}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* 正确答案 */}
                              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                <Lightbulb className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-medium text-green-700 dark:text-green-400">正确答案：{ex.answer}</p>
                                  {ex.explanation && <p className="text-xs text-muted-foreground mt-1 text-pretty">{ex.explanation}</p>}
                                </div>
                              </div>
                              {/* 笔记 */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <StickyNote className="w-3.5 h-3.5" />
                                  我的笔记
                                </div>
                                <Textarea
                                  placeholder="添加学习笔记..."
                                  value={noteMap[entry.id] ?? ''}
                                  onChange={e => setNoteMap(prev => ({ ...prev, [entry.id]: e.target.value }))}
                                  className="text-xs resize-none h-20"
                                />
                                <Button variant="outline" size="sm" onClick={() => saveNote(entry.id)} className="h-7 text-xs">
                                  保存笔记
                                </Button>
                              </div>
                              {/* 操作 */}
                              <div className="flex gap-2 pt-1">
                                <Button
                                  size="sm"
                                  variant={entry.mastered ? 'outline' : 'default'}
                                  onClick={() => toggleMastered(entry)}
                                  className="flex-1 gap-1.5 h-8 text-xs"
                                >
                                  {entry.mastered ? <Circle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  {entry.mastered ? '标为未掌握' : '标为已掌握'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeEntry(entry.id)}
                                  className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </CardContent>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
