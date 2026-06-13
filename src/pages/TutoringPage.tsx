import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AIChatPanel, { type ChatMsg } from '@/components/ai/AIChatPanel';
import DigitalTeacher from '@/components/tutoring/DigitalTeacher';
import VoiceCallModal from '@/components/voice/VoiceCallModal';
import PhotoSearchModal from '@/components/tutoring/PhotoSearchModal';
import { toast } from 'sonner';
import {
  MessageCircle, Bot, Sparkles, BookOpen, Lightbulb, Download,
  Brain, Zap, FileText, Phone, Camera, Volume2, VolumeX, Loader2,
} from 'lucide-react';

const suggestedQuestions = [
  '什么是机器学习？',
  '请解释深度学习和机器学习的区别',
  '如何高效学习数据结构？',
  '推荐算法学习的路线',
  'Python入门有什么建议？',
];

const tips = [
  { icon: Lightbulb, text: '可以询问任何课程相关的概念和原理' },
  { icon: BookOpen, text: '输入任何学习问题，AI 将实时流式回答' },
  { icon: Sparkles, text: '支持导出对话为 Markdown 文件' },
];

// 苏格拉底式辅导系统提示词
const SOCRATIC_SYSTEM_PROMPT = `你是一位采用苏格拉底教学法的AI导师。你的核心原则：
1. 【不直接给答案】遇到问题先用提问引导学生思考，例如"你觉得这个概念的核心是什么？"
2. 【分步引导】将复杂问题拆分，每次只引导一个思考方向
3. 【反问促思】当学生回答后，追问"为什么这样认为？""有没有例外情况？"
4. 【肯定鼓励】对学生的思考给予正向反馈，增强学习信心
5. 【适时总结】在学生经过思考得出答案后，帮助归纳和强化知识点
请始终以引导者而非答题者的角色出现，让学生通过自己的思考获得顿悟。`;

// 直接回答系统提示词
const DIRECT_SYSTEM_PROMPT = `你是智学伴AI答疑助手，为高校学生提供精准、清晰的学习辅导。
回答时请：简洁明了、逻辑清晰、配合示例、适当使用Markdown格式增强可读性。`;

export default function TutoringPage() {
  const { user } = useAuth();
  const [initialMessages, setInitialMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [socraticMode, setSocraticMode] = useState(false);
  const [teacherCollapsed, setTeacherCollapsed] = useState(false);
  const [lastAIMsg, setLastAIMsg] = useState('');
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [photoSearchOpen, setPhotoSearchOpen] = useState(false);
  // TTS 状态
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── TTS：朗读最新 AI 回复 ───────────────────────────────
  const handleTTS = useCallback(async () => {
    if (!lastAIMsg) { toast.error('暂无可朗读的内容'); return; }
    if (ttsPlaying) {
      audioRef.current?.pause();
      setTtsPlaying(false);
      return;
    }
    setTtsLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/minimax-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            text: lastAIMsg.replace(/[#*`>_~\[\]]/g, '').slice(0, 1000),
            voice_id: 'male-qn-jingying',
            speed: 1.0,
          }),
        }
      );
      if (!resp.ok) throw new Error(await resp.text());
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setTtsPlaying(false); toast.error('音频播放失败'); };
      await audio.play();
      setTtsPlaying(true);
    } catch (e) {
      toast.error('语音合成失败：' + (e as Error).message);
    } finally {
      setTtsLoading(false);
    }
  }, [lastAIMsg, ttsPlaying]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase.from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_type', 'tutoring')
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        const welcomeMsg = socraticMode
          ? '你好！我是智学伴的**苏格拉底式AI导师** 🤔\n\n我不会直接给出答案，而是通过提问引导你自己找到答案。这样能帮助你真正理解知识，而不只是记住答案。\n\n遇到任何问题，和我一起思考吧！'
          : '你好！我是智学伴智能答疑助手。支持文字和图片提问。请问有什么可以帮助你？';
        const msgs = Array.isArray(data) && data.length > 0
          ? data.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))
          : [{ id: 'welcome', role: 'assistant' as const, content: welcomeMsg }];
        setInitialMessages(msgs);
        setMessages(msgs);
        setLoading(false);
      });
  }, [user]);

  const handleSaveMessage = async (msg: ChatMsg) => {
    if (!user) return;
    setMessages(prev => {
      const exists = prev.find(m => m.id === msg.id);
      return exists ? prev.map(m => m.id === msg.id ? msg : m) : [...prev, msg];
    });
    // 记录最新 AI 消息，驱动数字人表情/说话
    if (msg.role === 'assistant') setLastAIMsg(msg.content);
    try {
      await supabase.from('chat_messages').insert({
        user_id: user.id, session_type: 'tutoring', role: msg.role, content: msg.content,
      });
    } catch (err) { console.error('保存消息失败:', err); }
  };


  const exportMarkdown = () => {
    if (messages.length === 0) { toast.warning('暂无对话内容'); return; }
    const md = messages.map(m => {
      const role = m.role === 'user' ? '**我**' : '**智学伴 AI**';
      return `${role}\n\n${m.content}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([`# 智学伴 答疑对话记录\n\n${md}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `答疑记录-${new Date().toLocaleDateString('zh-CN')}.md`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('对话已导出为 Markdown 文件');
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            智能答疑
          {/* 语音通话 + 拍照搜题按钮 */}
            <Button
              size="sm"
              onClick={() => setVoiceCallOpen(true)}
              className="gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 hover:from-sky-600 hover:to-violet-600 text-white border-0 shadow-md shadow-sky-500/20 ml-1"
            >
              <Phone className="w-3.5 h-3.5" />
              语音通话
            </Button>
            <Button
              size="sm"
              onClick={() => setPhotoSearchOpen(true)}
              className="gap-1.5 rounded-full bg-gradient-to-r from-orange-400 to-rose-500 hover:from-orange-500 hover:to-rose-600 text-white border-0 shadow-md shadow-orange-400/20 ml-1"
            >
              <Camera className="w-3.5 h-3.5" />
              拍照搜题
            </Button>
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 苏格拉底模式切换 */}
            <button
              type="button"
              onClick={() => {
                setSocraticMode(!socraticMode);
                toast.success(!socraticMode ? '已开启苏格拉底式引导模式 🤔' : '已切换回直接回答模式 ⚡');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                socraticMode
                  ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300'
                  : 'border-border text-muted-foreground hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              {socraticMode ? <Brain className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              {socraticMode ? '苏格拉底引导模式' : '直接回答模式'}
            </button>

            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportMarkdown}>
              <Download className="w-3.5 h-3.5" />
              导出对话
            </Button>

            {/* TTS 朗读最新 AI 回复 */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleTTS}
              disabled={ttsLoading || !lastAIMsg}
            >
              {ttsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : ttsPlaying ? (
                <VolumeX className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              {ttsPlaying ? '停止朗读' : '朗读回复'}
            </Button>
          </div>
        </div>

        {/* 多模态解答形式选择器已移除 */}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 左侧：数字人老师面板 */}
          <div className={`lg:col-span-1 ${teacherCollapsed ? 'lg:col-span-1' : ''}`}>
            <Card className="h-[calc(100vh-240px)] min-h-[520px] overflow-hidden">
              <CardContent className="p-3 h-full">
                <DigitalTeacher
                  lastAIMessage={lastAIMsg}
                  loading={loading}
                  collapsed={teacherCollapsed}
                  onToggle={() => setTeacherCollapsed(v => !v)}
                />
              </CardContent>
            </Card>
          </div>

          {/* 中间：对话区域 */}
          <div className={teacherCollapsed ? 'lg:col-span-3' : 'lg:col-span-2'}>
            <Card className="h-[calc(100vh-240px)] min-h-[520px] flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <CardTitle className="text-base flex items-center gap-2">
                  {socraticMode
                    ? <Brain className="w-4 h-4 text-amber-500" />
                    : <Bot className="w-4 h-4 text-primary" />
                  }
                  {socraticMode ? '苏格拉底式引导助手' : '智能答疑助手'}
                  {socraticMode && (
                    <span className="ml-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full font-normal">
                      引导思考模式
                    </span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground font-normal">支持多模态输入</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-muted-foreground">加载历史消息...</p>
                    </div>
                  </div>
                ) : (
                  <AIChatPanel
                    sessionType="tutoring"
                    initialMessages={initialMessages}
                    onMessageSent={handleSaveMessage}
                    onReplyReceived={handleSaveMessage}
                    suggestedQuestions={suggestedQuestions}
                    placeholder={socraticMode ? '提出你的问题，AI 将引导你自己思考...' : '输入你的学习问题，AI将实时流式回答...'}
                    systemPrompt={socraticMode ? SOCRATIC_SYSTEM_PROMPT : DIRECT_SYSTEM_PROMPT}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：使用提示 + 推荐问题（折叠时占1列，否则占1列） */}
          <div className="space-y-4 lg:col-span-1">
            {/* 苏格拉底模式说明 */}
            {socraticMode && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Brain className="w-4 h-4" />苏格拉底教学法
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    '🤔 AI不直接给答案，引导你思考',
                    '💭 通过提问发现问题本质',
                    '✨ 让理解更深刻、记忆更持久',
                    '🎯 培养独立思考和解题能力',
                  ].map(t => (
                    <p key={t} className="text-xs text-amber-600 dark:text-amber-400">{t}</p>
                  ))}
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-secondary" />使用提示
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <tip.icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground text-pretty">{tip.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary" />推荐问题
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestedQuestions.map((q, i) => (
                  <button key={i} type="button" className="w-full text-left p-2.5 rounded-lg bg-muted/50 hover:bg-muted text-xs transition-colors text-pretty">
                    {q}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <VoiceCallModal open={voiceCallOpen} onClose={() => setVoiceCallOpen(false)} />
      <PhotoSearchModal open={photoSearchOpen} onClose={() => setPhotoSearchOpen(false)} />
    </AppLayout>
  );
}

