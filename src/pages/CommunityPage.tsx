import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users, Heart, MessageSquare, Share2, Send, User, Clock, Flame, Sparkles,
  Hash, ChevronRight, ArrowLeft, TrendingUp, BookOpen, Code2, Brain,
  Calculator, Globe, Microscope, Music,
} from 'lucide-react';

interface Post {
  id: string;
  user_id: string;
  title: string;
  content: string;
  post_type: 'share' | 'question' | 'discussion';
  likes_count: number;
  replies_count: number;
  created_at: string;
  is_liked?: boolean;
}

interface Reply {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// 话题圈子定义
const CIRCLES = [
  { id: 'all', name: '全部', icon: Globe, color: 'text-primary', bg: 'bg-primary/10', members: '8.2k', hot: true, desc: '所有话题帖子汇总' },
  { id: 'cs', name: '计算机圈', icon: Code2, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', members: '3.1k', hot: true, desc: '计算机学习交流与资源共享' },
  { id: 'ai', name: 'AI学习圈', icon: Brain, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20', members: '2.4k', hot: true, desc: 'AI学习与技术前沿讨论' },
  { id: 'math', name: '数学圈', icon: Calculator, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', members: '1.8k', hot: false, desc: '数学问题解答与思维拓展' },
  { id: 'exam', name: '考研备考圈', icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', members: '2.9k', hot: true, desc: '考研备考经验与资料分享' },
  { id: 'science', name: '理工科圈', icon: Microscope, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', members: '1.5k', hot: false, desc: '理工科知识交流与实验分享' },
  { id: 'arts', name: '文艺圈', icon: Music, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20', members: '900', hot: false, desc: '文艺创作与灵感交流' },
];

const typeOptions = [
  { value: 'all', label: '全部' },
  { value: 'share', label: '学习分享' },
  { value: 'question', label: '问题求助' },
  { value: 'discussion', label: '话题讨论' },
];

const typeColor: Record<string, string> = {
  share: 'bg-primary/10 text-primary',
  question: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  discussion: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
};

const typeLabel: Record<string, string> = {
  share: '学习分享', question: '问题求助', discussion: '话题讨论',
};

export default function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [repliesMap, setRepliesMap] = useState<Record<string, Reply[]>>({});
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState<'latest' | 'hot'>('latest');
  const [search, setSearch] = useState('');
  const [newPost, setNewPost] = useState<{ title: string; content: string; type: 'share' | 'question' | 'discussion' }>({ title: '', content: '', type: 'share' });
  const [showNewPost, setShowNewPost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({});
  const [activeCircle, setActiveCircle] = useState('all');
  const [joinedCircles, setJoinedCircles] = useState<string[]>(['all', 'cs']);
  const [view, setView] = useState<'circles' | 'feed'>('circles');

  useEffect(() => { loadPosts(); }, [filterType, sortBy, activeCircle]);

  const loadPosts = async () => {
    setLoading(true);
    let query = supabase.from('community_posts').select('*');
    if (filterType !== 'all') query = query.eq('post_type', filterType);
    if (sortBy === 'hot') query = query.order('likes_count', { ascending: false });
    else query = query.order('created_at', { ascending: false });
    const { data } = await query.limit(30);
    setPosts(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const loadReplies = async (postId: string) => {
    if (repliesMap[postId]) return;
    setReplyLoading(prev => ({ ...prev, [postId]: true }));
    const { data } = await supabase.from('community_replies').select('*').eq('post_id', postId).order('created_at', { ascending: true }).limit(50);
    setRepliesMap(prev => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
    setReplyLoading(prev => ({ ...prev, [postId]: false }));
  };

  const toggleExpand = (postId: string) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    loadReplies(postId);
  };

  const handleLike = async (post: Post) => {
    if (!user) { toast.error('请先登录'); return; }
    const isLiked = post.is_liked;
    const newLikes = isLiked ? Math.max(0, post.likes_count - 1) : post.likes_count + 1;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: newLikes, is_liked: !isLiked } : p));
    await supabase.from('community_posts').update({ likes_count: newLikes }).eq('id', post.id);
  };

  const handleCreatePost = async () => {
    if (!user) { toast.error('请先登录'); return; }
    if (!newPost.title.trim() || !newPost.content.trim()) { toast.error('标题和内容不能为空'); return; }
    const { error } = await supabase.from('community_posts').insert({
      user_id: user.id, title: newPost.title, content: newPost.content, post_type: newPost.type, likes_count: 0, replies_count: 0,
    });
    if (error) { toast.error('发布失败：' + error.message); return; }
    toast.success('发布成功！');
    setNewPost({ title: '', content: '', type: 'share' });
    setShowNewPost(false);
    loadPosts();
  };

  const handleReply = async (postId: string) => {
    if (!user) { toast.error('请先登录'); return; }
    const text = replyText[postId]?.trim();
    if (!text) { toast.error('请输入回复内容'); return; }
    setReplyLoading(prev => ({ ...prev, [postId]: true }));
    const { error } = await supabase.from('community_replies').insert({ post_id: postId, user_id: user.id, content: text });
    if (error) { toast.error('回复失败'); setReplyLoading(prev => ({ ...prev, [postId]: false })); return; }
    const post = posts.find(p => p.id === postId);
    if (post) await supabase.from('community_posts').update({ replies_count: (post.replies_count ?? 0) + 1 }).eq('id', postId);
    setReplyText(prev => ({ ...prev, [postId]: '' }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, replies_count: (p.replies_count ?? 0) + 1 } : p));
    toast.success('回复成功！');
    const { data } = await supabase.from('community_replies').select('*').eq('post_id', postId).order('created_at', { ascending: true });
    setRepliesMap(prev => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
    setReplyLoading(prev => ({ ...prev, [postId]: false }));
  };

  const toggleJoinCircle = (circleId: string) => {
    if (circleId === 'all') return;
    setJoinedCircles(prev =>
      prev.includes(circleId) ? prev.filter(c => c !== circleId) : [...prev, circleId]
    );
    toast.success(joinedCircles.includes(circleId) ? '已退出圈子' : '加入成功！');
  };

  const enterCircle = (circleId: string) => {
    setActiveCircle(circleId);
    setView('feed');
  };

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  const displayedPosts = posts.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase()));
  const currentCircle = CIRCLES.find(c => c.id === activeCircle) || CIRCLES[0];

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            {view === 'feed' && (
              <button type="button" onClick={() => setView('circles')} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Users className="w-5 h-5 text-primary" />
            {view === 'circles' ? '学习社群' : (
              <span className="flex items-center gap-1.5">
                <currentCircle.icon className={`w-4 h-4 ${currentCircle.color}`} />
                {currentCircle.name}
              </span>
            )}
          </h1>
          {view === 'feed' && (
            <Button onClick={() => setShowNewPost(!showNewPost)} size="sm">
              <Share2 className="w-4 h-4 mr-1.5" />{showNewPost ? '取消' : '发布'}
            </Button>
          )}
        </div>

        {/* 圈子视图 */}
        {view === 'circles' && (
          <div className="space-y-5">
            {/* ── 顶部 Banner ── */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/80 via-emerald-500 to-teal-500 p-5 text-white shadow-lg">
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute right-8 bottom-0 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
              <div className="relative">
                <p className="text-xs text-white/70 mb-1 font-medium">🎯 探索话题圈子</p>
                <h2 className="text-lg font-bold text-balance">找到志同道合的学习伙伴</h2>
                <p className="text-white/80 text-sm mt-1">加入圈子，分享学习心得与讨论</p>
              </div>
            </div>

            {/* ── 数据统计 ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '社群成员', value: '8.2k+', icon: Users, color: 'text-primary', bg: 'bg-primary/10', trend: '+12%' },
                { label: '今日帖子', value: '326', icon: MessageSquare, color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-900/30', trend: '+8%' },
                { label: '活跃圈子', value: '7', icon: Hash, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/30', trend: '全部' },
                { label: '互动总量', value: '12.4k', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', trend: '+24%' },
              ].map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="h-full hover:shadow-md transition-all duration-200">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                        <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold leading-none">{stat.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                      </div>
                      <span className="ml-auto text-[10px] font-medium text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full shrink-0">{stat.trend}</span>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* ── 推荐圈子（横向） ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-pink-500" />
                <p className="text-sm font-semibold">推荐</p>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                {CIRCLES.filter(c => c.id !== 'all' && c.hot).map(circle => {
                  const isJoined = joinedCircles.includes(circle.id);
                  return (
                    <div key={circle.id} className="shrink-0 flex flex-col items-center text-center w-28">
                      <div className={`w-12 h-12 rounded-full ${circle.bg} flex items-center justify-center border-2 border-white dark:border-white/10 shadow-md`}>
                        <circle.icon className={`w-6 h-6 ${circle.color}`} />
                      </div>
                      <p className="text-xs font-medium mt-2 truncate w-full">{circle.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{circle.members}热度</p>
                      <Button
                        size="sm"
                        className="mt-1.5 h-7 text-xs bg-gradient-to-r from-pink-400 to-rose-400 text-white border-0 hover:from-pink-500 hover:to-rose-500"
                        onClick={() => toggleJoinCircle(circle.id)}
                      >
                        {isJoined ? '已关注' : '关注'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 热门圈子（网格） ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-pink-500" />
                <p className="text-sm font-semibold">热门圈子</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CIRCLES.filter(c => c.id !== 'all').map((circle, idx) => {
                  const isJoined = joinedCircles.includes(circle.id);
                  const todayCount = circle.id.length * 7 + 3;
                  const postCount = circle.id.length * 120 + 80;
                  const likeCount = circle.id.length * 45 + 20;
                  return (
                    <motion.div
                      key={circle.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                    >
                      <div
                        className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => enterCircle(circle.id)}
                      >
                        <div className={`w-12 h-12 rounded-full ${circle.bg} flex items-center justify-center shrink-0`}>
                          <circle.icon className={`w-6 h-6 ${circle.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold">{circle.name}</h3>
                            <span className="text-[10px] flex items-center gap-0.5 text-muted-foreground">
                              <MessageSquare className="w-3 h-3" /> 今日: {todayCount}
                            </span>
                            {circle.hot && <Flame className="w-4 h-4 text-red-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed text-pretty">{circle.desc}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {postCount}</span>
                            <span className="flex items-center gap-0.5"><Flame className="w-3 h-3" /> {circle.members}</span>
                            <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {likeCount}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 帖子列表视图 */}
        {view === 'feed' && (
          <div className="space-y-4">
            {/* 搜索 + 排序 */}
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Input placeholder="搜索帖子..." value={search} onChange={e => setSearch(e.target.value)} className="pl-3" />
              </div>
              <Button
                variant={sortBy === 'hot' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy(sortBy === 'hot' ? 'latest' : 'hot')}
                className="shrink-0 gap-1.5"
              >
                {sortBy === 'hot' ? <Flame className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                {sortBy === 'hot' ? '最热' : '最新'}
              </Button>
            </div>

            {/* 发布框 */}
            <AnimatePresence>
              {showNewPost && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <Input placeholder="标题" value={newPost.title} onChange={e => setNewPost(prev => ({ ...prev, title: e.target.value }))} />
                      <Textarea placeholder="分享你的学习心得或提出问题..." rows={3} value={newPost.content} onChange={e => setNewPost(prev => ({ ...prev, content: e.target.value }))} />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {typeOptions.slice(1).map(t => (
                            <button key={t.value} type="button" onClick={() => setNewPost(prev => ({ ...prev, type: t.value as 'share' | 'question' | 'discussion' }))}
                              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${newPost.type === t.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <Button size="sm" onClick={handleCreatePost}><Send className="w-3.5 h-3.5 mr-1" />发布</Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 类型过滤 */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {typeOptions.map(t => (
                <button key={t.value} type="button" onClick={() => setFilterType(t.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${filterType === t.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* 帖子列表 */}
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}><CardContent className="p-4"><div className="animate-pulse space-y-2"><div className="h-4 w-2/3 bg-muted rounded" /><div className="h-3 w-full bg-muted rounded" /></div></CardContent></Card>
                ))
              ) : displayedPosts.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground text-sm">
                    <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    {search ? `未找到含"${search}"的帖子` : '暂无帖子，来发布第一条吧！'}
                  </CardContent>
                </Card>
              ) : (
                displayedPosts.map((post, idx) => (
                  <motion.div key={post.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                    <Card className="overflow-hidden hover:shadow-hover transition-shadow duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={`${typeColor[post.post_type]} border-0 text-[10px]`}>{typeLabel[post.post_type]}</Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />{formatTime(post.created_at)}
                              </span>
                            </div>
                            <h3 className="text-sm font-medium mb-1 text-pretty">{post.title}</h3>
                            <p className="text-xs text-muted-foreground text-pretty line-clamp-3">{post.content}</p>
                            <div className="flex items-center gap-4 mt-3">
                              <button type="button" onClick={() => handleLike(post)}
                                className={`flex items-center gap-1 text-xs transition-colors ${post.is_liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}>
                                <Heart className={`w-3.5 h-3.5 ${post.is_liked ? 'fill-current' : ''}`} />
                                {post.likes_count ?? 0}
                              </button>
                              <button type="button" onClick={() => toggleExpand(post.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                                <MessageSquare className="w-3.5 h-3.5" />{post.replies_count ?? 0} 回复
                              </button>
                            </div>
                            <AnimatePresence>
                              {expandedPost === post.id && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                                    {replyLoading[post.id] ? (
                                      <div className="text-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
                                    ) : (
                                      (repliesMap[post.id] || []).length === 0
                                        ? <p className="text-xs text-muted-foreground text-center py-2">暂无回复</p>
                                        : <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {repliesMap[post.id].map(reply => (
                                              <div key={reply.id} className="flex gap-2">
                                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                                                  <User className="w-3 h-3 text-muted-foreground" />
                                                </div>
                                                <div className="flex-1 bg-muted/50 rounded-lg px-3 py-2">
                                                  <p className="text-xs text-pretty">{reply.content}</p>
                                                  <span className="text-[10px] text-muted-foreground mt-0.5">{formatTime(reply.created_at)}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                    )}
                                    <div className="flex gap-2">
                                      <Textarea placeholder="写下你的回复..." rows={1} value={replyText[post.id] || ''}
                                        onChange={e => setReplyText(prev => ({ ...prev, [post.id]: e.target.value }))}
                                        className="flex-1 min-h-0 text-xs py-2"
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(post.id); }}} />
                                      <Button size="icon" className="shrink-0 h-8 w-8" onClick={() => handleReply(post.id)} disabled={replyLoading[post.id]}>
                                        <Send className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
