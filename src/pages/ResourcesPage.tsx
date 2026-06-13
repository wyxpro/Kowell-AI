import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  BookOpen, Plus, FileText, Brain, Target, Code, Search, Filter,
  Eye, Edit, Clock, Heart, Star, Tag, Sparkles,
} from 'lucide-react';
import type { Resource, Course } from '@/types/types';
import { RESOURCE_TYPE_LABELS } from '@/types/types';

const resourceIcons: Record<string, React.ReactNode> = {
  document: <FileText className="w-5 h-5" />,
  mindmap: <Brain className="w-5 h-5" />,
  exercise: <Target className="w-5 h-5" />,
  reading: <BookOpen className="w-5 h-5" />,
  code: <Code className="w-5 h-5" />,
};

const resourceColors: Record<string, string> = {
  document: 'bg-primary/10 text-primary',
  mindmap: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  exercise: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  reading: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  code: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
};

function StarRating({ rating, count, onRate }: { rating: number; count: number; onRate: (r: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button
          key={s}
          type="button"
          className="p-0.5"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onRate(s)}
        >
          <Star className={`w-3.5 h-3.5 ${(hovered || rating) >= s ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
        </button>
      ))}
      {count > 0 && <span className="text-xs text-muted-foreground ml-0.5">({count})</span>}
    </div>
  );
}

export default function ResourcesPage() {
  const { user, profile } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');

  useEffect(() => {
    if (!user || !profile) return;
    const fetchData = async () => {
      const [coursesRes, resourcesRes, favRes] = await Promise.all([
        supabase.from('courses').select('*').order('name'),
        supabase.from('resources').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('favorites').select('resource_id').eq('user_id', user.id),
      ]);
      setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
      setResources(Array.isArray(resourcesRes.data) ? resourcesRes.data : []);
      setFavorites(new Set((favRes.data ?? []).map((f: { resource_id: string }) => f.resource_id)));
      setLoading(false);
    };
    fetchData();
  }, [user, profile]);

  const allTags = Array.from(new Set(resources.flatMap(r => r.tags ?? []))).slice(0, 12);

  const filtered = resources.filter(r => {
    const matchType = filter === 'all' || r.resource_type === filter;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase());
    const matchTag = !activeTag || (r.tags ?? []).includes(activeTag);
    return matchType && matchSearch && matchTag;
  });

  const toggleFavorite = async (res: Resource, e: React.MouseEvent) => {
    e.preventDefault();
    if (!profile) return;
    const isFav = favorites.has(res.id);
    if (isFav) {
      await supabase.from('favorites').delete().eq('user_id', profile.id).eq('resource_id', res.id);
      setFavorites(prev => { const next = new Set(prev); next.delete(res.id); return next; });
      toast('已取消收藏');
    } else {
      await supabase.from('favorites').insert({ user_id: profile.id, resource_id: res.id });
      setFavorites(prev => new Set([...prev, res.id]));
      toast.success('已收藏 ❤️');
    }
  };

  const rateResource = async (res: Resource, score: number) => {
    if (!profile) return;
    await supabase.from('resource_ratings').upsert(
      { user_id: profile.id, resource_id: res.id, rating: score },
      { onConflict: 'user_id,resource_id' }
    );
    // 更新平均分
    const newCount = res.rating_count + 1;
    const newRating = ((res.rating * res.rating_count) + score) / newCount;
    await supabase.from('resources').update({ rating: newRating, rating_count: newCount }).eq('id', res.id);
    setResources(prev => prev.map(r => r.id === res.id ? { ...r, rating: newRating, rating_count: newCount } : r));
    toast.success('评分已提交！');
  };

  const markAsRead = async (res: Resource) => {
    if (res.is_read) return;
    await supabase.from('resources').update({ is_read: true }).eq('id', res.id);
    setResources(prev => prev.map(r => r.id === res.id ? { ...r, is_read: true } : r));
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            资源中心
          </h1>
          <Button asChild>
            <Link to="/resources/generate"><Plus className="w-4 h-4 mr-2" />生成资源</Link>
          </Button>
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜索资源..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full md:w-40 shrink-0">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="资源类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="document">课程文档</SelectItem>
              <SelectItem value="mindmap">思维导图</SelectItem>
              <SelectItem value="exercise">练习题库</SelectItem>
              <SelectItem value="reading">拓展阅读</SelectItem>
              <SelectItem value="code">代码案例</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 标签云 */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTag('')}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors ${!activeTag ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground hover:border-primary hover:text-primary'}`}
            >
              <Tag className="w-3 h-3" />全部
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${activeTag === tag ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border text-muted-foreground hover:border-primary hover:text-primary'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* 资源列表 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 bg-muted rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-base font-semibold mb-2">暂无学习资源</h3>
              <p className="text-sm text-muted-foreground mb-4">生成个性化学习资源，开启高效学习</p>
              <Button asChild><Link to="/resources/generate"><Plus className="w-4 h-4 mr-2" />生成资源</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((res, idx) => (
              <motion.div
                key={res.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="h-full"
              >
                <Card className="h-full flex flex-col hover:shadow-hover transition-all duration-200 hover:-translate-y-0.5 group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`rounded-xl p-2.5 ${resourceColors[res.resource_type] || 'bg-muted text-muted-foreground'}`}>
                        {resourceIcons[res.resource_type] || <FileText className="w-5 h-5" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {res.source === 'ai' && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Sparkles className="w-2.5 h-2.5" />AI
                          </Badge>
                        )}
                        {!res.is_read && <Badge variant="secondary" className="text-xs">未读</Badge>}
                        <button
                          type="button"
                          onClick={e => toggleFavorite(res, e)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Heart className={`w-4 h-4 ${favorites.has(res.id) ? 'fill-destructive text-destructive' : ''}`} />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <h3 className="font-medium text-sm line-clamp-2 mb-1 text-balance">{res.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{RESOURCE_TYPE_LABELS[res.resource_type]}</p>

                    {/* 标签 */}
                    {(res.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(res.tags ?? []).slice(0, 3).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-xs">{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* 评分 */}
                    <div className="mb-auto">
                      <StarRating rating={Math.round(res.rating ?? 0)} count={res.rating_count ?? 0} onRate={r => rateResource(res, r)} />
                    </div>

                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border shrink-0">
                      <Button variant="outline" size="sm" className="flex-1 text-xs h-8" asChild onClick={() => markAsRead(res)}>
                        <Link to={`/resources/${res.id}`}><Eye className="w-3 h-3 mr-1" />查看</Link>
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
                        <Link to={`/resources/${res.id}/edit`}><Edit className="w-3 h-3" /></Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* 课程卡片区 */}
        {courses.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">可用课程</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {courses.map((course) => (
                <Card key={course.id} className="h-full hover:shadow-hover transition-all duration-200 hover:-translate-y-0.5">
                  <CardContent className="p-4 flex flex-col gap-2 h-full">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">{course.major}</Badge>
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-sm text-balance">{course.name}</h3>
                    <p className="text-xs text-muted-foreground text-pretty flex-1">{course.description}</p>
                    <Button asChild variant="outline" size="sm" className="mt-auto">
                      <Link to={`/resources/generate?course=${course.id}`}><Plus className="w-3 h-3 mr-1" />生成资源</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

