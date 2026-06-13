import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookText, Plus, Search, Trash2, Tag, X, Save, StickyNote, Clock,
  Hash, Bold, Italic, List, Code, Heading2, AlignLeft, CheckCircle2,
  Circle, BookMarked, Brain, Target, ChevronDown, ChevronUp, Lightbulb, RefreshCw,
} from 'lucide-react';
import type { Note, WrongBookEntry } from '@/types/types';

const TAG_COLORS = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
];

function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[h];
}

function formatDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ─── 工具栏插入辅助 ────────────────────────────────────────────────
function insertMarkdown(textarea: HTMLTextAreaElement | null, before: string, after = '', placeholder = '') {
  if (!textarea) return '';
  const { selectionStart: s, selectionEnd: e, value: v } = textarea;
  const selected = v.slice(s, e) || placeholder;
  const newVal = v.slice(0, s) + before + selected + after + v.slice(e);
  return newVal;
}

// ─── 错题本条目组件 ────────────────────────────────────────────────
function WrongEntry({ entry, onToggle, onNote }: {
  entry: WrongBookEntry;
  onToggle: (e: WrongBookEntry) => void;
  onNote: (id: string, note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState(entry.note ?? '');
  const ex = entry.exercises;
  if (!ex) return null;

  return (
    <motion.div
      layout
      className={`rounded-xl border p-3 transition-colors ${entry.mastered ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-900/10' : 'border-border bg-card'}`}
    >
      <div className="flex items-start gap-2.5">
        <button type="button" onClick={() => onToggle(entry)} className="shrink-0 mt-0.5">
          {entry.mastered
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
          }
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium line-clamp-2 text-pretty ${entry.mastered ? 'line-through text-muted-foreground' : ''}`}>
            {ex.question}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {ex.difficulty && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {ex.difficulty === 'easy' ? '简单' : ex.difficulty === 'medium' ? '中等' : '困难'}
              </Badge>
            )}
            {ex.category && <span className="text-[10px] text-muted-foreground">{ex.category}</span>}
            <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(entry.created_at)}</span>
          </div>
        </div>
        <button type="button" onClick={() => setExpanded(v => !v)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2.5 pl-6">
              {ex.explanation && (
                <div className="rounded-lg bg-muted/60 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Lightbulb className="w-3 h-3" />解析</p>
                  <p className="text-xs text-pretty">{ex.explanation}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">我的笔记</p>
                <Textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="记录你的复习笔记..."
                  className="text-xs resize-none min-h-[56px] bg-background/60"
                  rows={2}
                />
                <div className="flex justify-end mt-1.5">
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2 gap-1"
                    onClick={() => onNote(entry.id, noteText)}>
                    <Save className="w-3 h-3" />保存笔记
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────
export default function NotesPage() {
  const { user, profile } = useAuth();
  // 笔记状态
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Note | null>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'notes' | 'wrong'>('notes');
  const [previewMode, setPreviewMode] = useState(false);

  // 错题本状态
  const [wrongEntries, setWrongEntries] = useState<WrongBookEntry[]>([]);
  const [wrongLoading, setWrongLoading] = useState(false);
  const [wrongTab, setWrongTab] = useState<'all' | 'pending' | 'mastered'>('all');
  const [wrongSearch, setWrongSearch] = useState('');

  // textarea ref for toolbar
  const [textareaEl, setTextareaEl] = useState<HTMLTextAreaElement | null>(null);

  useEffect(() => { if (user) loadNotes(); }, [user]);
  useEffect(() => { if (activeTab === 'wrong' && profile) loadWrongBook(); }, [activeTab, profile]);

  const loadNotes = async () => {
    setLoading(true);
    const { data } = await supabase.from('notes').select('*').eq('user_id', user!.id).order('updated_at', { ascending: false });
    const list = Array.isArray(data) ? data : [];
    setNotes(list);
    setLoading(false);
    if (list.length > 0 && !selected) selectNote(list[0]);
  };

  const loadWrongBook = async () => {
    setWrongLoading(true);
    const { data } = await supabase.from('wrong_book')
      .select('*, exercises(id,question,options,answer,explanation,difficulty,category)')
      .eq('user_id', profile!.id).order('created_at', { ascending: false });
    setWrongEntries(Array.isArray(data) ? data : []);
    setWrongLoading(false);
  };

  const selectNote = (note: Note) => {
    setSelected(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTags(note.tags || []);
  };

  const createNote = async () => {
    const { data, error } = await supabase.from('notes').insert({ user_id: user!.id, title: '新笔记', content: '', tags: [] }).select().maybeSingle();
    if (error || !data) { toast.error('创建失败'); return; }
    const list = [data, ...notes];
    setNotes(list);
    selectNote(data);
    toast.success('笔记已创建');
  };

  const saveNote = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from('notes').update({ title: editTitle || '无标题', content: editContent, tags: editTags, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { toast.error('保存失败'); setSaving(false); return; }
    setNotes(prev => prev.map(n => n.id === selected.id ? { ...n, title: editTitle || '无标题', content: editContent, tags: editTags, updated_at: new Date().toISOString() } : n));
    setSelected(prev => prev ? { ...prev, title: editTitle || '无标题', content: editContent, tags: editTags } : null);
    setSaving(false);
    toast.success('已保存');
  }, [selected, editTitle, editContent, editTags]);

  const deleteNote = async (id: string) => {
    await supabase.from('notes').delete().eq('id', id);
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    if (selected?.id === id) { setSelected(next[0] || null); if (next[0]) selectNote(next[0]); }
    toast.success('已删除');
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (!t || editTags.includes(t)) { setTagInput(''); return; }
    setEditTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setEditTags(prev => prev.filter(x => x !== t));

  const toggleMastered = async (entry: WrongBookEntry) => {
    await supabase.from('wrong_book').update({ mastered: !entry.mastered }).eq('id', entry.id);
    setWrongEntries(prev => prev.map(e => e.id === entry.id ? { ...e, mastered: !e.mastered } : e));
    toast.success(entry.mastered ? '已标记为待复习' : '🎉 已掌握！');
  };

  const saveWrongNote = async (id: string, note: string) => {
    await supabase.from('wrong_book').update({ note }).eq('id', id);
    setWrongEntries(prev => prev.map(e => e.id === id ? { ...e, note } : e));
    toast.success('笔记已保存');
  };

  // 工具栏操作
  const applyFormat = (before: string, after = '', placeholder = '文本') => {
    const newVal = insertMarkdown(textareaEl, before, after, placeholder);
    setEditContent(newVal);
    setTimeout(() => textareaEl?.focus(), 50);
  };

  const allTags = [...new Set(notes.flatMap(n => n.tags || []))];
  const filtered = notes.filter(n => {
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase());
    const matchTag = !tagFilter || (n.tags || []).includes(tagFilter);
    return matchSearch && matchTag;
  });

  const filteredWrong = wrongEntries.filter(e => {
    if (wrongTab === 'pending' && e.mastered) return false;
    if (wrongTab === 'mastered' && !e.mastered) return false;
    if (wrongSearch && !e.exercises?.question.toLowerCase().includes(wrongSearch.toLowerCase())) return false;
    return true;
  });

  const wrongStats = {
    total: wrongEntries.length,
    mastered: wrongEntries.filter(e => e.mastered).length,
    pending: wrongEntries.filter(e => !e.mastered).length,
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-120px)] flex flex-col gap-0">
        {/* 顶栏 */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookText className="w-5 h-5 text-primary" />我的笔记
          </h1>
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'notes' | 'wrong')}>
            <TabsList className="h-8">
              <TabsTrigger value="notes" className="text-xs gap-1.5 px-3">
                <StickyNote className="w-3.5 h-3.5" />笔记
              </TabsTrigger>
              <TabsTrigger value="wrong" className="text-xs gap-1.5 px-3">
                <BookMarked className="w-3.5 h-3.5" />数据统计
                {wrongStats.pending > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] flex items-center justify-center">{wrongStats.pending}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={activeTab} className="flex-1 min-h-0">
          {/* ─── 笔记 Tab ─────────────────────────────────────────── */}
          <TabsContent value="notes" className="h-full mt-0">
            <div className="flex gap-4 h-full">
              {/* 左栏：笔记列表 */}
              <div className="w-64 shrink-0 flex flex-col gap-2 h-full">
                <div className="flex gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input className="pl-8 h-8 text-xs" placeholder="搜索笔记..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <Button size="sm" className="h-8 px-2.5 gap-1 text-xs shrink-0" onClick={createNote}>
                    <Plus className="w-3.5 h-3.5" />新建
                  </Button>
                </div>

                {/* 标签筛选 */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => setTagFilter('')}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${!tagFilter ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                      全部
                    </button>
                    {allTags.slice(0, 6).map(t => (
                      <button key={t} type="button" onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${tagFilter === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                        #{t}
                      </button>
                    ))}
                  </div>
                )}

                {/* 笔记列表 */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                  {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-muted" />) :
                    filtered.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">
                        <StickyNote className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">暂无笔记</p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {filtered.map((note, i) => (
                          <motion.div key={note.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                            <button type="button" onClick={() => selectNote(note)}
                              className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id === note.id ? 'bg-primary/5 border-primary/40 shadow-sm' : 'bg-card border-border hover:border-primary/20 hover:bg-muted/30'}`}>
                              <div className="font-medium text-sm truncate">{note.title || '无标题'}</div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 text-pretty">{note.content || '空笔记...'}</p>
                              <div className="flex items-center justify-between mt-1.5">
                                <div className="flex gap-1 flex-wrap">
                                  {(note.tags || []).slice(0, 2).map(t => (
                                    <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full ${tagColor(t)}`}>#{t}</span>
                                  ))}
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0 ml-1 flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" />{formatDate(note.updated_at)}
                                </span>
                              </div>
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                </div>
              </div>

              {/* 右栏：专业编辑器 */}
              <div className="flex-1 min-w-0 h-full">
                {selected ? (
                  <Card className="h-full flex flex-col overflow-hidden">
                    {/* 标题行 */}
                    <div className="px-5 pt-4 pb-3 border-b border-border flex items-center gap-3 shrink-0">
                      <Input
                        className="text-lg font-bold border-none shadow-none px-0 focus-visible:ring-0 bg-transparent flex-1 min-w-0"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        placeholder="笔记标题..."
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => setPreviewMode(v => !v)}>
                          <AlignLeft className="w-3.5 h-3.5" />{previewMode ? '编辑' : '预览'}
                        </Button>
                        <Button size="sm" onClick={saveNote} disabled={saving} className="h-7 px-3 text-xs gap-1">
                          <Save className="w-3.5 h-3.5" />{saving ? '保存中...' : '保存'}
                        </Button>
                        <button type="button" onClick={() => deleteNote(selected.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 标签行 */}
                    <div className="px-5 py-2 border-b border-border flex items-center gap-2 flex-wrap shrink-0 bg-muted/20">
                      <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
                      {editTags.map(t => (
                        <button key={t} type="button" onClick={() => removeTag(t)}
                          className={`flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full hover:opacity-70 transition-opacity ${tagColor(t)}`}>
                          <Hash className="w-2.5 h-2.5" />{t}<X className="w-2.5 h-2.5 ml-0.5" />
                        </button>
                      ))}
                      <div className="flex items-center gap-1">
                        <Input className="h-5 text-[11px] px-2 w-20 border-dashed rounded-full"
                          placeholder="+ 标签" value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && addTag()} />
                      </div>
                    </div>

                    {/* Markdown 工具栏 */}
                    {!previewMode && (
                      <div className="px-4 py-1.5 border-b border-border flex items-center gap-0.5 bg-muted/10 shrink-0 flex-wrap">
                        {[
                          { icon: Heading2, label: '标题', action: () => applyFormat('## ', '', '标题文字') },
                          { icon: Bold, label: '加粗', action: () => applyFormat('**', '**', '加粗文字') },
                          { icon: Italic, label: '斜体', action: () => applyFormat('*', '*', '斜体文字') },
                          { icon: Code, label: '代码', action: () => applyFormat('`', '`', 'code') },
                          { icon: List, label: '列表', action: () => applyFormat('- ', '', '列表项') },
                          { icon: CheckCircle2, label: '任务', action: () => applyFormat('- [ ] ', '', '任务项') },
                        ].map(({ icon: Icon, label, action }) => (
                          <button key={label} type="button" onClick={action} title={label}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        ))}
                        <div className="ml-auto text-[10px] text-muted-foreground">Ctrl+S 保存</div>
                      </div>
                    )}

                    {/* 编辑/预览区 */}
                    <CardContent className="flex-1 p-0 min-h-0 overflow-hidden">
                      {previewMode ? (
                        <div className="h-full overflow-y-auto px-5 py-4">
                          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                            {editContent ? (
                              <pre className="whitespace-pre-wrap font-sans text-sm">{editContent}</pre>
                            ) : (
                              <p className="text-muted-foreground italic">空笔记...</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Textarea
                          ref={el => setTextareaEl(el)}
                          className="w-full h-full resize-none rounded-none border-none shadow-none px-5 py-4 focus-visible:ring-0 text-sm leading-relaxed bg-transparent font-mono"
                          placeholder={'开始记录你的想法...\n\n## 支持 Markdown\n\n- **加粗** / *斜体*\n- `代码`\n- 列表项\n- [ ] 任务项\n\nCtrl+S 快速保存'}
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveNote(); } }}
                        />
                      )}
                    </CardContent>

                    {/* 状态栏 */}
                    <div className="px-5 py-1.5 border-t border-border flex items-center justify-between shrink-0 bg-muted/10">
                      <span className="text-[11px] text-muted-foreground">{editContent.length} 字 · {editContent.split('\n').length} 行</span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(selected.updated_at)} 更新</span>
                    </div>
                  </Card>
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <StickyNote className="w-16 h-16 mx-auto mb-4 opacity-20" />
                      <p className="text-base font-medium mb-1">选择笔记开始编辑</p>
                      <p className="text-sm mb-4">或新建一条笔记</p>
                      <Button size="sm" onClick={createNote}><Plus className="w-4 h-4 mr-1" />新建笔记</Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── 错题本 Tab ───────────────────────────────────────── */}
          <TabsContent value="wrong" className="h-full mt-0">
            <div className="flex flex-col h-full gap-3">
              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-3 shrink-0">
                {[
                  { label: '全部错题', val: wrongStats.total, icon: BookMarked, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
                  { label: '待复习', val: wrongStats.pending, icon: Target, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                  { label: '已掌握', val: wrongStats.mastered, icon: Brain, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                ].map(s => (
                  <Card key={s.label} className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`}>
                        <s.icon className={`w-4 h-4 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{s.val}</p>
                        <p className="text-[11px] text-muted-foreground">{s.label}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* 工具栏 */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-xs" placeholder="搜索错题..." value={wrongSearch} onChange={e => setWrongSearch(e.target.value)} />
                </div>
                <Tabs value={wrongTab} onValueChange={v => setWrongTab(v as typeof wrongTab)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-2.5">全部</TabsTrigger>
                    <TabsTrigger value="pending" className="text-xs px-2.5">待复习</TabsTrigger>
                    <TabsTrigger value="mastered" className="text-xs px-2.5">已掌握</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={loadWrongBook}>
                  <RefreshCw className="w-3.5 h-3.5" />刷新
                </Button>
              </div>

              {/* 错题列表 */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
                {wrongLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-muted" />)
                ) : filteredWrong.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <BookMarked className="w-14 h-14 mx-auto mb-3 opacity-15" />
                    <p className="text-sm font-medium">暂无错题记录</p>
                    <p className="text-xs mt-1">完成练习后，错题将自动收录到这里</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {filteredWrong.map((entry, i) => (
                      <motion.div key={entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <WrongEntry entry={entry} onToggle={toggleMastered} onNote={saveWrongNote} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

