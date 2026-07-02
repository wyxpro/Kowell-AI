import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
import { stepAudioService } from '@/services/ai';
import {
  MessageCircle, Bot, Sparkles, BookOpen, Lightbulb, Download,
  Brain, Zap, FileText, Phone, Camera, Volume2, VolumeX, Loader2,
  Plus, MessageSquare, Pin, Trash2
} from 'lucide-react';

const suggestedQuestions = [
  '什么是机器学习？',
  '请解释深度学习和机器学习的区别',
  '如何高效学习数据结构？',
  '推荐算法学习的路线',
  'Python入门有什么建议？',
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
const DIRECT_SYSTEM_PROMPT = `你是 Kowell AI 答疑助手，为高校学生提供精准、清晰的学习辅导。
回答时请：简洁明了、逻辑清晰、配合示例、适当使用Markdown格式增强可读性。`;

interface SessionGroup {
  id: string;
  title: string;
  created_at: string;
  messages: ChatMsg[];
}

export default function TutoringPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionGroup[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pinnedSessionIds, setPinnedSessionIds] = useState<string[]>([]);
  const [initialMessages, setInitialMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [socraticMode, setSocraticMode] = useState(false);
  const [teacherCollapsed, setTeacherCollapsed] = useState(false);
  const [lastAIMsg, setLastAIMsg] = useState('');
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [photoSearchOpen, setPhotoSearchOpen] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Web Speech API 降级播放
  const fallbackWebSpeech = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      toast.error('语音播放失败，您的浏览器不支持语音合成');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.onend = () => setTtsPlaying(false);
    utterance.onerror = () => {
      setTtsPlaying(false);
      toast.error('本地语音播放失败');
    };
    setTtsPlaying(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleTTS = useCallback(async () => {
    if (!lastAIMsg) { toast.error('暂无可朗读的内容'); return; }
    if (ttsPlaying) {
      if (window.speechSynthesis?.speaking) {
        window.speechSynthesis.cancel();
      }
      audioRef.current?.pause();
      setTtsPlaying(false);
      return;
    }
    setTtsLoading(true);
    const cleanText = lastAIMsg.replace(/[#*`>_~\[\]]/g, '').slice(0, 1000);
    try {
      let blob: Blob;
      try {
        // 🚀 优先调用 StepAudio-2.5-TTS 语音合成 (高保真表现力)
        blob = await stepAudioService.textToSpeech({
          text: cleanText,
          voice: 'cixingnansheng',
          instruction: '语气温柔，语速偏慢'
        });
        console.log('StepAudio TTS synthesized successfully.');
      } catch (stepErr) {
        console.warn('StepAudio TTS failed, falling back to MiniMax TTS:', stepErr);
        // 🔄 第一级降级：使用 MiniMax TTS
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/minimax-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              text: cleanText,
              voice_id: 'male-qn-jingying',
              speed: 1.0,
            }),
          }
        );
        if (!resp.ok) throw new Error(await resp.text());
        blob = await resp.blob();
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => {
        console.warn('Audio playback failed, falling back to Web Speech API');
        fallbackWebSpeech(cleanText);
      };
      await audio.play();
      setTtsPlaying(true);
    } catch (e) {
      console.warn('All cloud TTS failed, falling back to Web Speech API:', e);
      fallbackWebSpeech(cleanText);
    } finally {
      setTtsLoading(false);
    }
  }, [lastAIMsg, ttsPlaying, fallbackWebSpeech]);

  const loadSessions = useCallback(async (selectId?: string) => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_type', 'tutoring')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('加载历史消息失败:', error);
        return;
      }

      const groups: { [key: string]: ChatMsg[] } = {};
      const firstMsgTimes: { [key: string]: string } = {};

      if (data) {
        data.forEach(m => {
          const sid = m.session_id || 'default';
          if (!groups[sid]) {
            groups[sid] = [];
            firstMsgTimes[sid] = m.created_at || new Date().toISOString();
          }
          groups[sid].push({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content
          });
        });
      }

      const sortedSessions = Object.keys(groups).map(sid => {
        const msgs = groups[sid];
        const firstUserMsg = msgs.find(m => m.role === 'user');
        const title = firstUserMsg
          ? (firstUserMsg.content.length > 15 ? firstUserMsg.content.slice(0, 15) + '...' : firstUserMsg.content)
          : '答疑助手对话';
        return {
          id: sid,
          title,
          created_at: firstMsgTimes[sid],
          messages: msgs
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setSessions(sortedSessions);

      let activeId = selectId;
      if (!activeId) {
        if (sortedSessions.length > 0) {
          activeId = sortedSessions[0].id;
        } else {
          activeId = crypto.randomUUID();
        }
      }

      setCurrentSessionId(activeId);

      const activeSession = sortedSessions.find(s => s.id === activeId);
      let activeMsgs: ChatMsg[] = [];
      if (activeSession) {
        activeMsgs = activeSession.messages;
      } else {
        const welcomeMsg = socraticMode
          ? '你好！我是 Kowell AI 的**苏格拉底式AI导师** 🤔\n\n我不会直接给出答案，而是通过提问引导你自己找到答案。这样能帮助你真正理解知识，而不只是记住答案。\n\n遇到任何问题，和我一起思考吧！'
          : '你好！我是 Kowell AI 智能答疑助手。支持文字和图片提问。请问有什么可以帮助你？';
        activeMsgs = [{
          id: 'welcome',
          role: 'assistant',
          content: welcomeMsg
        }];
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          session_type: 'tutoring',
          role: 'assistant',
          content: welcomeMsg,
          session_id: activeId
        });
      }

      setInitialMessages(activeMsgs);
      setMessages(activeMsgs);

      const aiMsgs = activeMsgs.filter(m => m.role === 'assistant');
      if (aiMsgs.length > 0) {
        setLastAIMsg(aiMsgs[aiMsgs.length - 1].content);
      } else {
        setLastAIMsg('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, socraticMode]);

  useEffect(() => {
    if (user) {
      loadSessions();
    } else {
      setLoading(false);
    }
  }, [user, loadSessions]);

  useEffect(() => {
    if (user) {
      const key = `kowell_pinned_${user.id}_tutoring`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setPinnedSessionIds(JSON.parse(saved));
        } catch {
          setPinnedSessionIds([]);
        }
      }
    }
  }, [user]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aPinned = pinnedSessionIds.includes(a.id);
      const bPinned = pinnedSessionIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [sessions, pinnedSessionIds]);

  const handleSelectSession = (sid: string) => {
    setLoading(true);
    loadSessions(sid);
  };

  const handleNewSession = async () => {
    setLoading(true);
    const newId = crypto.randomUUID();
    await loadSessions(newId);
    toast.success('已新建智能答疑对话');
  };

  const handleTogglePin = (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    const key = `kowell_pinned_${user.id}_tutoring`;
    let newPinned = [...pinnedSessionIds];
    if (newPinned.includes(sid)) {
      newPinned = newPinned.filter(id => id !== sid);
      toast.success('已取消置顶');
    } else {
      newPinned.push(sid);
      toast.success('已置顶对话');
    }
    setPinnedSessionIds(newPinned);
    localStorage.setItem(key, JSON.stringify(newPinned));
  };

  const handleDeleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const { error } = await supabase.from('chat_messages')
        .delete()
        .eq('session_id', sid);

      if (error) throw error;

      const key = `kowell_pinned_${user.id}_tutoring`;
      const newPinned = pinnedSessionIds.filter(id => id !== sid);
      setPinnedSessionIds(newPinned);
      localStorage.setItem(key, JSON.stringify(newPinned));

      toast.success('对话已删除');

      if (currentSessionId === sid) {
        await loadSessions();
      } else {
        await loadSessions(currentSessionId || undefined);
      }
    } catch (err) {
      toast.error('删除失败');
    }
  };

  const handleSaveMessage = async (msg: ChatMsg) => {
    if (!user || !currentSessionId) return;

    const cleanMsg = {
      ...msg,
      content: msg.content.replace(/<think>[\s\S]*?(?:<\/think>|$)\n?/gi, '')
    };

    setMessages(prev => {
      const exists = prev.find(m => m.id === cleanMsg.id);
      return exists ? prev.map(m => m.id === cleanMsg.id ? cleanMsg : m) : [...prev, cleanMsg];
    });

    if (cleanMsg.role === 'assistant') setLastAIMsg(cleanMsg.content);

    try {
      await supabase.from('chat_messages').insert({
        user_id: user.id,
        session_type: 'tutoring',
        role: cleanMsg.role,
        content: cleanMsg.content,
        session_id: currentSessionId
      });

      const { data } = await supabase.from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_type', 'tutoring')
        .eq('session_id', currentSessionId)
        .order('created_at', { ascending: true });

      if (data) {
        const msgs = data.map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }));
        setInitialMessages(msgs);
      }

      const { data: allData } = await supabase.from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_type', 'tutoring')
        .order('created_at', { ascending: true });

      if (allData) {
        const groups: { [key: string]: ChatMsg[] } = {};
        const firstMsgTimes: { [key: string]: string } = {};
        allData.forEach(m => {
          const sid = m.session_id || 'default';
          if (!groups[sid]) {
            groups[sid] = [];
            firstMsgTimes[sid] = m.created_at || new Date().toISOString();
          }
          groups[sid].push({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content });
        });
        const sorted = Object.keys(groups).map(sid => {
          const msgs = groups[sid];
          const firstUserMsg = msgs.find(m => m.role === 'user');
          const title = firstUserMsg
            ? (firstUserMsg.content.length > 15 ? firstUserMsg.content.slice(0, 15) + '...' : firstUserMsg.content)
            : '答疑助手对话';
          return { id: sid, title, created_at: firstMsgTimes[sid], messages: msgs };
        }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setSessions(sorted);
      }
    } catch (err) {
      console.error('保存消息失败:', err);
    }
  };

  const exportMarkdown = () => {
    if (messages.length === 0) { toast.warning('暂无对话内容'); return; }
    const md = messages.map(m => {
      const role = m.role === 'user' ? '**我**' : '**Kowell AI**';
      return `${role}\n\n${m.content}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([`# Kowell AI 答疑对话记录\n\n${md}`], { type: 'text/markdown;charset=utf-8' });
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 中间/左侧：对话区域（合并了历史对话侧边栏） */}
          <div className={teacherCollapsed ? 'lg:col-span-4' : 'lg:col-span-3'}>
            <Card className="h-[calc(100vh-240px)] min-h-[520px] flex overflow-hidden">
              {/* 合并左侧的侧边栏：历史记录 */}
              <div className="hidden md:flex w-56 border-r border-border flex-col bg-muted/10 shrink-0">
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    历史对话
                  </span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleNewSession} title="新建对话">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {sortedSessions.map(s => {
                    const isPinned = pinnedSessionIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectSession(s.id)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-center justify-between group cursor-pointer ${
                          s.id === currentSessionId
                            ? 'bg-primary text-primary-foreground shadow-sm font-medium'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {isPinned && <Pin className="w-3 h-3 text-amber-500 shrink-0 rotate-45" />}
                          <span className="truncate pr-2">{s.title}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <span className="text-[9px] opacity-70 mr-1">
                            {new Date(s.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                          </span>
                          <button
                            onClick={(e) => handleTogglePin(s.id, e)}
                            className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${
                              isPinned ? 'text-amber-500' : 'text-muted-foreground'
                            }`}
                            title={isPinned ? "取消置顶" : "置顶对话"}
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors"
                            title="删除对话"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {sortedSessions.length === 0 && !loading && (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      暂无历史记录
                    </div>
                  )}
                </div>
              </div>

              {/* 合并右侧：对话主面板 */}
              <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-card">
                <CardHeader className="pb-3 shrink-0 border-b border-border/40">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
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
                    </span>
                    <div className="flex items-center gap-1.5">
                      {teacherCollapsed && (
                        <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 py-0" onClick={() => setTeacherCollapsed(false)}>
                          展开数字人
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="md:hidden h-7 px-2 text-[10px]" onClick={handleNewSession}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 p-4">
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
              </div>
            </Card>
          </div>

          {/* 右侧：数字人老师 + 模式说明 */}
          {!teacherCollapsed && (
            <div className="space-y-4 lg:col-span-1 flex flex-col h-[calc(100vh-240px)] min-h-[520px]">
              <Card className="flex-1 overflow-hidden">
                <CardContent className="p-3 h-full">
                  <DigitalTeacher
                    lastAIMessage={lastAIMsg}
                    loading={loading}
                    collapsed={teacherCollapsed}
                    onToggle={() => setTeacherCollapsed(v => !v)}
                  />
                </CardContent>
              </Card>

              {/* 苏格拉底模式说明 */}
              {socraticMode && (
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 shrink-0">
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
            </div>
          )}
        </div>
      </div>
      <VoiceCallModal open={voiceCallOpen} onClose={() => setVoiceCallOpen(false)} />
      <PhotoSearchModal open={photoSearchOpen} onClose={() => setPhotoSearchOpen(false)} />
    </AppLayout>
  );
}
