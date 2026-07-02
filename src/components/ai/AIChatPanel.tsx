import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { textAIService } from '@/services/ai';
import { stepAudioService } from '@/services/ai';
import {
  Send, Bot, User, Loader2, Square, ImageIcon, Mic, MicOff, Film, X,
  Paperclip, GraduationCap, Brain
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Markdown 渲染器（无需第三方库） ─── */
function MarkdownContent({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <span className="whitespace-pre-wrap text-pretty">{content}</span>;
  }

  let thinkContent = '';
  let mainContent = content;
  const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (thinkMatch) {
    thinkContent = thinkMatch[1].trim();
    mainContent = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
  }

  const lines = mainContent.split('\n');
  const elements: React.ReactNode[] = [];

  if (thinkContent) {
    elements.push(
      <details key="think-block" className="group mb-3 border border-border/50 rounded-lg bg-muted/30 overflow-hidden">
        <summary className="text-xs text-muted-foreground font-medium p-2 cursor-pointer select-none flex items-center gap-1.5 hover:bg-muted/50 transition-colors">
          <Brain className="w-3.5 h-3.5" />
          <span className="group-open:hidden">深度思考过程</span>
          <span className="hidden group-open:inline">收起思考过程</span>
        </summary>
        <div className="p-3 pt-1 text-xs text-muted-foreground whitespace-pre-wrap border-t border-border/50 leading-relaxed">
          {thinkContent}
        </div>
      </details>
    );
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // H1 / H2 / H3 / H4 / H5
    if (/^##### /.test(line)) {
      elements.push(<p key={i} className="text-xs font-semibold mt-2 mb-0.5 text-foreground">{renderInline(line.replace(/^#{1,5} /, ''))}</p>);
    } else if (/^#### /.test(line)) {
      elements.push(<p key={i} className="text-xs font-bold mt-2 mb-1 text-foreground">{renderInline(line.replace(/^#### /, ''))}</p>);
    } else if (/^### /.test(line)) {
      elements.push(<h3 key={i} className="text-sm font-bold mt-3 mb-1 text-foreground">{renderInline(line.replace(/^### /, ''))}</h3>);
    } else if (/^## /.test(line)) {
      elements.push(<h2 key={i} className="text-sm font-bold mt-3 mb-1.5 text-foreground border-b border-border/40 pb-1">{renderInline(line.replace(/^## /, ''))}</h2>);
    } else if (/^# /.test(line)) {
      elements.push(<h1 key={i} className="text-base font-extrabold mt-3 mb-2 text-foreground">{renderInline(line.replace(/^# /, ''))}</h1>);
    // 有序列表
    } else if (/^\d+\. /.test(line.trimStart())) {
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      elements.push(
        <div key={i} className={`flex gap-2 text-sm leading-relaxed ${indent > 0 ? 'ml-4' : ''}`}>
          <span className="text-primary font-semibold shrink-0 min-w-[1.2rem]">{line.trimStart().match(/^(\d+)\./)?.[1]}.</span>
          <span className="text-pretty">{renderInline(line.trimStart().replace(/^\d+\. /, ''))}</span>
        </div>
      );
    // 无序列表 - / * / •
    } else if (/^[-*•] /.test(line.trimStart())) {
      const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      elements.push(
        <div key={i} className={`flex gap-2 text-sm leading-relaxed ${indent > 0 ? 'ml-4' : ''}`}>
          <span className="text-primary shrink-0 mt-1">•</span>
          <span className="text-pretty">{renderInline(line.trimStart().replace(/^[-*•] /, ''))}</span>
        </div>
      );
    // 代码块开始
    } else if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-2 rounded-lg overflow-hidden border border-border/60">
          {lang && <div className="px-3 py-1 bg-muted/80 text-[10px] text-muted-foreground font-mono border-b border-border/40">{lang}</div>}
          <pre className="px-3 py-2.5 text-xs font-mono leading-relaxed overflow-x-auto bg-muted/50 text-foreground">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
    // 分割线
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-3 border-border/40" />);
    // 引用块
    } else if (/^> /.test(line)) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-primary/40 pl-3 my-1.5 text-sm text-muted-foreground italic">
          {renderInline(line.replace(/^> /, ''))}
        </blockquote>
      );
    // 空行
    } else if (line.trim() === '') {
      if (elements.length > 0) elements.push(<div key={i} className="h-1.5" />);
    // 普通段落
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed text-pretty">{renderInline(line)}</p>);
    }
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

/* 内联样式：**粗体** `代码` */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[2]}</strong>);
    else if (match[3]) parts.push(<code key={match.index} className="px-1 py-0.5 rounded bg-muted/70 text-xs font-mono text-primary">{match[3]}</code>);
    else if (match[4]) parts.push(<em key={match.index} className="italic">{match[4]}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}


export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AttachedMedia {
  type: 'image' | 'video' | 'audio';
  url: string;
  name: string;
  dataUrl?: string;
}

interface AIChatPanelProps {
  sessionType: 'tutoring' | 'portrait';
  initialMessages?: ChatMsg[];
  onMessageSent?: (msg: ChatMsg) => void;
  onReplyReceived?: (msg: ChatMsg) => void;
  suggestedQuestions?: string[];
  placeholder?: string;
  disabled?: boolean;
  pendingImage?: { url: string; name: string };
  onImageSent?: () => void;
  systemPrompt?: string;
}

export default function AIChatPanel({
  sessionType,
  initialMessages = [],
  onMessageSent,
  onReplyReceived,
  suggestedQuestions,
  placeholder = '输入你的问题...',
  disabled = false,
  pendingImage,
  onImageSent,
  systemPrompt,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<AttachedMedia[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingText]);

  // 同步历史对话记录
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // 外部 pendingImage 兼容
  useEffect(() => {
    if (pendingImage) {
      setAttachedMedia(prev => {
        const exists = prev.some(m => m.url === pendingImage.url);
        if (exists) return prev;
        return [...prev, { type: 'image', url: pendingImage.url, name: pendingImage.name }];
      });
    }
  }, [pendingImage]);

  // 图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        setAttachedMedia(prev => [...prev, { type: 'image', url: dataUrl, name: file.name, dataUrl }]);
      };
      reader.readAsDataURL(file);
    });
    if (imageRef.current) imageRef.current.value = '';
  };

  // 视频选择
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (!file.type.startsWith('video/')) return;
      if (file.size > 100 * 1024 * 1024) { toast.error('视频不超过100MB'); return; }
      const url = URL.createObjectURL(file);
      setAttachedMedia(prev => [...prev, { type: 'video', url, name: file.name }]);
    });
    if (videoRef.current) videoRef.current.value = '';
  };

  // 语音录制
  const toggleRecording = useCallback(async () => {
    if (recording) {
      // 停止录制
      mediaRecorderRef.current?.stop();
      setRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setRecordSeconds(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        
        const toastId = toast.loading('正在通过 StepAudio-2.5-ASR 识别语音...');
        try {
          const text = await stepAudioService.transcribeBlob(blob);
          if (text.trim()) {
            setInput(prev => prev ? prev + ' ' + text : text);
            toast.success('语音识别成功', { id: toastId });
          } else {
            toast.warning('未能识别到有效的语音内容', { id: toastId });
          }
        } catch (e) {
          console.error(e);
          toast.error('语音识别失败，已添加音频附件', { id: toastId });
        }

        setAttachedMedia(prev => [...prev, { type: 'audio', url, name: '语音消息.wav' }]);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch {
      toast.error('无法访问麦克风，请检查权限');
    }
  }, [recording]);

  const removeMedia = (idx: number) => {
    setAttachedMedia(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride || input).trim();
    if (!text && attachedMedia.length === 0) return;
    if (loading || disabled) return;

    // 构建消息内容
    let userContent = text;
    if (attachedMedia.length > 0) {
      const mediaLines = attachedMedia.map(m => {
        if (m.type === 'image') return `![图片](${m.url})`;
        if (m.type === 'video') return `🎬 [视频: ${m.name}]`;
        if (m.type === 'audio') return `🎙️ [语音消息]`;
        return '';
      }).join('\n');
      userContent = mediaLines + (text ? '\n\n' + text : '');
      // 通知外部图片已发送
      if (attachedMedia.some(m => m.type === 'image')) onImageSent?.();
    } else if (pendingImage) {
      userContent = `![上传图片](${pendingImage.url})\n\n${text}`;
      onImageSent?.();
    }

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: userContent };
    setMessages(prev => [...prev, userMsg]);
    onMessageSent?.(userMsg);
    setInput('');
    setAttachedMedia([]);
    setLoading(true);
    setStreamingText('');

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    let fullReply = '';
    const chatCallbacks = {
      onChunk: (chunk: string) => {
        fullReply += chunk;
        setStreamingText(fullReply);
      },
      onDone: () => {
        if (fullReply) {
          const assistantMsg: ChatMsg = { id: `a-${Date.now()}`, role: 'assistant', content: fullReply };
          setMessages(prev => [...prev, assistantMsg]);
          onReplyReceived?.(assistantMsg);
        }
        setLoading(false);
        setStreamingText('');
      },
      onError: (err: string) => {
        const errorMsg: ChatMsg = { id: `e-${Date.now()}`, role: 'assistant', content: `抱歉，请求出错：${err}` };
        setMessages(prev => [...prev, errorMsg]);
        setLoading(false);
        setStreamingText('');
      },
    };

    if (sessionType === 'portrait') {
      await textAIService.streamPortraitChat(
        history,
        chatCallbacks,
        abortRef.current.signal
      );
    } else {
      await textAIService.streamTutoringChat(
        history,
        'socratic',
        chatCallbacks,
        abortRef.current.signal
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const displayMessages = [...messages];
  if (streamingText) displayMessages.push({ id: 'streaming', role: 'assistant', content: streamingText });

  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4 pb-4">
          {displayMessages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-sky-100 dark:bg-sky-900/40'
              }`}>
                {msg.role === 'user'
                  ? <User className="w-4 h-4" />
                  : sessionType === 'portrait'
                    ? <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    : <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                }
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-muted rounded-tl-sm'
              }`}>
                {/* 渲染图片附件 */}
                {msg.content.includes('![图片](') && (
                  <div className="mb-2 space-y-1">
                    {msg.content.match(/!\[图片\]\(([^)]+)\)/g)?.map((match, i) => {
                      const url = match.match(/!\[图片\]\(([^)]+)\)/)?.[1];
                      return url ? <img key={i} src={url} alt="附图" className="max-w-[200px] rounded-lg" /> : null;
                    })}
                  </div>
                )}
                <MarkdownContent content={msg.content.replace(/!\[图片\]\([^)]+\)\n?/g, '').replace(/🎬 \[视频: [^\]]+\]\n?/g, '').replace(/🎙️ \[语音消息\]\n?/g, '')} isUser={msg.role === 'user'} />
                {msg.content.includes('🎬') && (
                  <div className="mt-1 flex items-center gap-1 text-xs opacity-70">
                    <Film className="w-3 h-3" />视频已附加
                  </div>
                )}
                {msg.content.includes('🎙️') && (
                  <div className="mt-1 flex items-center gap-1 text-xs opacity-70">
                    <Mic className="w-3 h-3" />语音已发送
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && !streamingText && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0">
                {sessionType === 'portrait'
                  ? <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  : <Bot className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                }
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator className="my-2" />

      {/* 附件预览区 */}
      {attachedMedia.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {attachedMedia.map((m, idx) => (
            <div key={idx} className="relative group">
              {m.type === 'image' && (
                <img src={m.url} alt={m.name} className="w-16 h-16 rounded-lg object-cover border border-border" />
              )}
              {m.type === 'video' && (
                <div className="w-16 h-16 rounded-lg bg-muted flex flex-col items-center justify-center border border-border">
                  <Film className="w-5 h-5 text-violet-500" />
                  <span className="text-[9px] text-muted-foreground mt-0.5 px-1 truncate w-full text-center">视频</span>
                </div>
              )}
              {m.type === 'audio' && (
                <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg border border-border">
                  <Mic className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">语音消息</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeMedia(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 快捷问题 — 输入框上方 */}
      {suggestedQuestions && suggestedQuestions.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1 shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(q)}
              disabled={loading}
              className="text-xs whitespace-nowrap px-2.5 py-1.5 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-border shrink-0"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 录音状态提示 */}
      {recording && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-600 dark:text-red-400 font-medium">录音中 {recordSeconds}s</span>
          <span className="text-xs text-muted-foreground ml-auto">点击麦克风停止</span>
        </div>
      )}

      {/* 输入区 */}
      <div className="flex gap-2 items-end shrink-0">
        {/* 多模态工具按鈕 */}
        <div className="flex gap-1 shrink-0">
          {/* 隐藏文件输入 */}
          <input ref={imageRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />

          <button
            type="button"
            title="上传图片"
            onClick={() => imageRef.current?.click()}
            disabled={loading || disabled}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors disabled:opacity-40"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            title={recording ? '停止录音' : '语音输入'}
            onClick={toggleRecording}
            disabled={loading || disabled}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 ${
              recording
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            }`}
          >
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            type="button"
            title="上传视频"
            onClick={() => videoRef.current?.click()}
            disabled={loading || disabled}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40"
          >
            <Film className="w-4 h-4" />
          </button>
        </div>

        <input
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 min-w-0"
          placeholder={placeholder}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || disabled}
        />
        {loading ? (
          <Button
            variant="destructive"
            size="icon"
            className="shrink-0"
            onClick={() => { abortRef.current?.abort(); setLoading(false); setStreamingText(''); }}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={() => handleSend()}
            disabled={(!input.trim() && attachedMedia.length === 0) || disabled}
            size="icon"
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        )}
      </div>

    </div>
  );
}
