import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import AIChatPanel, { type ChatMsg } from '@/components/ai/AIChatPanel';
import VoiceCallModal from '@/components/voice/VoiceCallModal';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Brain, Sparkles, CheckCircle, Target, BookOpen, Clock, AlertCircle, TrendingUp, ArrowRight } from 'lucide-react';

const portraitDimensions = [
  { key: 'major_direction', label: '专业方向', icon: Brain, desc: '专业领域和发展方向', color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
  { key: 'knowledge_base', label: '知识基础', icon: BookOpen, desc: '已掌握的核心课程和技能', color: 'bg-primary/10 text-primary' },
  { key: 'cognitive_style', label: '认知风格', icon: Target, desc: '偏好的学习方式和理解模式', color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' },
  { key: 'error_patterns', label: '易错点偏好', icon: AlertCircle, desc: '容易出错的知识点类型', color: 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'learning_rhythm', label: '学习节奏', icon: Clock, desc: '学习时间和节奏偏好', color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  { key: 'learning_goals', label: '学习目标', icon: TrendingUp, desc: '短期和长期学习目标', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
];

export default function PortraitPage() {
  const { user } = useAuth();
  const [initialMessages, setInitialMessages] = useState<ChatMsg[]>([]);
  const [completedDims, setCompletedDims] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voiceCallOpen] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_type', 'portrait')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (Array.isArray(data) && data.length > 0) {
          const msgs = data.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }));
          setInitialMessages(msgs);
          const userMsgs = msgs.filter(m => m.role === 'user');
          setCompletedDims(portraitDimensions.slice(0, userMsgs.length).map(d => d.key));
          if (userMsgs.length >= 6) setIsComplete(true);
        } else {
          setInitialMessages([{
            id: 'welcome',
            role: 'assistant',
            content: '你好！我是智学伴学习画像助手 🎓\n\n接下来我会通过 **6 个问题** 深入了解你的学习特征，帮助你构建专属的个性化学习画像，让 AI 更精准地为你推荐资源和路径。\n\n我们一起开始吧！\n\n**第一步：请告诉我你的专业方向是什么？**（例如：计算机科学、会计学、机械工程等）',
          }]);
        }
        setLoading(false);
      });
  }, [user]);

  const handleSaveMessage = async (msg: ChatMsg) => {
    if (!user) return;
    try {
      await supabase.from('chat_messages').insert({
        user_id: user.id, session_type: 'portrait', role: msg.role, content: msg.content,
      });
      if (msg.role === 'user') {
        const { data } = await supabase.from('chat_messages').select('*').eq('user_id', user.id).eq('session_type', 'portrait').eq('role', 'user');
        const count = Array.isArray(data) ? data.length : 0;
        const dims = portraitDimensions.slice(0, count).map(d => d.key);
        setCompletedDims(dims);
        if (count >= 6) {
          setIsComplete(true);
          await supabase.from('learning_portraits').upsert({
            user_id: user.id, is_complete: true,
            major_direction: { value: data?.[0]?.content || '' },
            knowledge_base: { value: data?.[1]?.content || '' },
            cognitive_style: { value: data?.[2]?.content || '' },
            error_patterns: { value: data?.[3]?.content || '' },
            learning_rhythm: { value: data?.[4]?.content || '' },
            learning_goals: { value: data?.[5]?.content || '' },
          }, { onConflict: 'user_id' });
          toast.success('🎉 学习画像构建完成！');
        }
      }
    } catch (err) {
      console.error('保存消息失败:', err);
    }
  };

  const progressPct = Math.round((completedDims.length / 6) * 100);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />学习画像构建
            </h1>
          </div>
          {isComplete && (
            <Badge className="bg-primary/10 text-primary border-0">
              <CheckCircle className="w-3 h-3 mr-1" />已完成
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="h-[calc(100vh-200px)] min-h-[500px] flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />对话式画像构建
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">加载中...</p>
                    </div>
                  </div>
                ) : (
                  <AIChatPanel
                    sessionType="portrait"
                    initialMessages={initialMessages}
                    onMessageSent={handleSaveMessage}
                    onReplyReceived={handleSaveMessage}
                    placeholder={isComplete ? '画像已构建完成，可以继续对话完善' : '回答画像助手的问题...'}
                    disabled={false}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {/* 进度卡片 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-secondary" />构建进度
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 进度条 */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{completedDims.length}/6 维度</span>
                    <span>{progressPct}%</span>
                  </div>
                  <Progress value={progressPct} className="h-2" />
                </div>
                {/* 维度列表 */}
                <div className="space-y-2.5">
                  {portraitDimensions.map((dim, i) => {
                    const completed = completedDims.includes(dim.key);
                    const isCurrent = !completed && completedDims.length === i;
                    return (
                      <motion.div
                        key={dim.key}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center gap-3"
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-all duration-300 ${
                          completed ? 'bg-primary text-primary-foreground shadow-sm'
                            : isCurrent ? 'bg-secondary text-secondary-foreground ring-2 ring-secondary/40'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {completed ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className={`rounded p-0.5 ${dim.color}`}>
                              <dim.icon className="w-3 h-3" />
                            </div>
                            <span className={`text-sm ${completed ? 'text-foreground font-medium' : isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                              {dim.label}
                            </span>
                            {isCurrent && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">进行中</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{dim.desc}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 完成引导 */}
            {isComplete ? (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium text-sm">画像构建完成！</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-pretty">
                    系统已生成包含 6 个维度的个性化学习画像。现在可以开始生成学习资源或规划路径了。
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Button asChild size="sm" className="w-full">
                      <Link to="/resources/generate"><BookOpen className="w-3.5 h-3.5 mr-1.5" />生成学习资源</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link to="/learning-path"><ArrowRight className="w-3.5 h-3.5 mr-1.5" />查看学习路径</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-secondary/20 bg-secondary/5">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground text-pretty">
                    💡 <strong>小提示</strong>：详细、真实地回答每个问题，AI 将为你生成更精准的个性化推荐。
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      <VoiceCallModal open={false} onClose={() => {}} />
    </AppLayout>
  );
}

