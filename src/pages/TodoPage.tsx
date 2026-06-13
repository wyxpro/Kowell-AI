import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { CheckSquare, Plus, Trash2, CheckCircle2, Circle, Flame, Clock, Flag, Calendar } from 'lucide-react';
import type { DailyTodo } from '@/types/types';

const priorityConfig = {
  high:   { label: '高优先级', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',   dot: 'bg-red-500' },
  medium: { label: '中优先级', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' },
  low:    { label: '低优先级', color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',   dot: 'bg-sky-500' },
};

const today = new Date().toISOString().split('T')[0];

export default function TodoPage() {
  const { user } = useAuth();
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as DailyTodo['priority'] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) loadTodos(); }, [user]);

  const loadTodos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('daily_todos')
      .select('*')
      .eq('user_id', user!.id)
      .eq('due_date', today)
      .order('created_at', { ascending: true });
    setTodos(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const toggleDone = async (todo: DailyTodo) => {
    const { error } = await supabase
      .from('daily_todos')
      .update({ is_done: !todo.is_done, updated_at: new Date().toISOString() })
      .eq('id', todo.id);
    if (error) { toast.error('更新失败'); return; }
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, is_done: !t.is_done } : t));
    if (!todo.is_done) toast.success('✅ 任务完成！继续加油');
  };

  const deleteTodo = async (id: string) => {
    await supabase.from('daily_todos').delete().eq('id', id);
    setTodos(prev => prev.filter(t => t.id !== id));
    toast.success('已删除');
  };

  const handleAdd = async () => {
    if (!form.title.trim()) { toast.error('请输入任务标题'); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('daily_todos')
      .insert({ user_id: user!.id, title: form.title, description: form.description || null, priority: form.priority, due_date: today })
      .select()
      .maybeSingle();
    if (error) { toast.error('添加失败'); setSaving(false); return; }
    if (data) setTodos(prev => [...prev, data]);
    setForm({ title: '', description: '', priority: 'medium' });
    setShowForm(false);
    setSaving(false);
    toast.success('任务已添加');
  };

  const displayed = todos.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.is_done : !t.is_done
  );
  const doneCount = todos.filter(t => t.is_done).length;
  const pct = todos.length ? Math.round((doneCount / todos.length) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-4 max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />今日待办
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1" />{showForm ? '取消' : '新增'}
          </Button>
        </div>

        {/* 进度概览 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">今日进度</span>
              </div>
              <span className="text-sm font-bold text-primary">{doneCount}/{todos.length}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <motion.div
                className="bg-primary h-2.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            {pct === 100 && todos.length > 0 && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-primary font-medium mt-2 text-center"
              >
                🎉 今日任务全部完成！太棒了！
              </motion.p>
            )}
          </CardContent>
        </Card>

        {/* 添加表单 */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">添加新任务</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="任务标题 *"
                    value={form.title}
                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  />
                  <Textarea
                    placeholder="任务描述（可选）"
                    rows={2}
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  />
                  <div className="flex items-center gap-3">
                    <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v as DailyTodo['priority'] }))}>
                      <SelectTrigger className="w-36">
                        <Flag className="w-3.5 h-3.5 mr-1.5" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">高优先级</SelectItem>
                        <SelectItem value="medium">中优先级</SelectItem>
                        <SelectItem value="low">低优先级</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button className="flex-1" onClick={handleAdd} disabled={saving}>
                      {saving ? '添加中...' : '确认添加'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 过滤标签 */}
        <div className="flex gap-2">
          {(['all', 'pending', 'done'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}
            >
              {{ all: '全部', pending: '进行中', done: '已完成' }[f]}
              <span className="ml-1 opacity-70">
                ({f === 'all' ? todos.length : f === 'done' ? doneCount : todos.length - doneCount})
              </span>
            </button>
          ))}
        </div>

        {/* 待办列表 */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><div className="h-5 bg-muted rounded animate-pulse" /></CardContent></Card>
            ))
          ) : displayed.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <CheckSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm">{filter === 'done' ? '暂无已完成的任务' : '今日待办为空，点击右上角新增吧！'}</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {displayed.map((todo, idx) => {
                const pc = priorityConfig[todo.priority];
                return (
                  <motion.div
                    key={todo.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <Card className={`transition-opacity ${todo.is_done ? 'opacity-60' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleDone(todo)}
                            className="mt-0.5 shrink-0 text-primary transition-transform hover:scale-110"
                          >
                            {todo.is_done
                              ? <CheckCircle2 className="w-5 h-5 text-primary" />
                              : <Circle className="w-5 h-5 text-muted-foreground" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-medium ${todo.is_done ? 'line-through text-muted-foreground' : ''}`}>
                                {todo.title}
                              </span>
                              <div className="flex items-center gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${pc.color}`}>{pc.label}</span>
                              </div>
                            </div>
                            {todo.description && (
                              <p className="text-xs text-muted-foreground mt-1 text-pretty">{todo.description}</p>
                            )}
                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>截止今日</span>
                              {todo.source !== 'manual' && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                                  {todo.source === 'path' ? '路径任务' : 'AI生成'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteTodo(todo.id)}
                            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
