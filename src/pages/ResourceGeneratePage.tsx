// 资源生成页
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { generateResource } from '@/lib/ai';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, FileText, Brain, Target, BookOpen, Code, ArrowRight, Loader2,
  CheckCircle, PenTool, Cpu, MessageSquare, FileCheck, Layers,
  Video, Presentation, Lock, Paperclip, X, ImageIcon, Film, FileUp,
  ChevronDown, ChevronUp,
} from 'lucide-react';

/* ─── Markdown 块渲染（AI生成内容用） ─── */
function renderMarkdownBlocks(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^### /.test(line)) {
      elements.push(<h3 key={i} className="text-sm font-bold mt-3 mb-1 text-foreground">{renderInline(line.replace(/^### /, ''))}</h3>);
    } else if (/^## /.test(line)) {
      elements.push(<h2 key={i} className="text-sm font-semibold mt-3 mb-1.5 text-primary border-b border-border/40 pb-1">{renderInline(line.replace(/^## /, ''))}</h2>);
    } else if (/^# /.test(line)) {
      elements.push(<h1 key={i} className="text-base font-bold mt-3 mb-2 text-foreground">{renderInline(line.replace(/^# /, ''))}</h1>);
    } else if (/^\d+\. /.test(line.trimStart())) {
      const num = line.trimStart().match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-primary font-semibold shrink-0 min-w-[1.2rem]">{num}.</span>
          <span className="text-pretty">{renderInline(line.trimStart().replace(/^\d+\. /, ''))}</span>
        </div>
      );
    } else if (/^[-*•] /.test(line.trimStart())) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-primary shrink-0 mt-1">•</span>
          <span className="text-pretty">{renderInline(line.trimStart().replace(/^[-*•] /, ''))}</span>
        </div>
      );
    } else if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(
        <div key={i} className="my-2 rounded-lg overflow-hidden border border-border/60">
          {lang && <div className="px-3 py-1 bg-muted text-[10px] font-mono text-muted-foreground border-b border-border/40">{lang}</div>}
          <pre className="px-3 py-2.5 text-xs font-mono leading-relaxed overflow-x-auto bg-muted/50 text-foreground"><code>{codeLines.join('\n')}</code></pre>
        </div>
      );
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-3 border-border/40" />);
    } else if (/^> /.test(line)) {
      elements.push(<blockquote key={i} className="border-l-2 border-primary/50 pl-3 my-1.5 text-sm text-muted-foreground italic">{renderInline(line.replace(/^> /, ''))}</blockquote>);
    } else if (line.trim() === '') {
      if (elements.length > 0) elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed text-pretty">{renderInline(line)}</p>);
    }
    i++;
  }
  return <div className="space-y-0.5 px-1">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let last = 0; let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[2]}</strong>);
    else if (match[3]) parts.push(<code key={match.index} className="px-1 py-0.5 rounded bg-muted text-xs font-mono text-primary">{match[3]}</code>);
    else if (match[4]) parts.push(<em key={match.index}>{match[4]}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}


// 计算机/AI 大类课程数据
const COURSE_CATALOG = [
  {
    category: '计算机基础',
    courses: ['数据结构', '算法设计与分析', '计算机组成原理', '操作系统', '计算机网络', '编译原理', '数据库原理', '软件工程'],
  },
  {
    category: '编程语言',
    courses: ['Python编程', 'Java编程', 'C/C++编程', 'JavaScript/前端开发', 'Go语言', 'Rust语言'],
  },
  {
    category: '人工智能',
    courses: ['机器学习', '深度学习', '自然语言处理', '计算机视觉', '强化学习', '知识图谱', '推荐系统', 'AI伦理与安全'],
  },
  {
    category: '数学基础',
    courses: ['线性代数', '概率论与数理统计', '离散数学', '数值分析', '最优化方法'],
  },
  {
    category: '系统与架构',
    courses: ['云计算', '分布式系统', '微服务架构', '容器与DevOps', '大数据技术'],
  },
];

const agentSteps = [
  { key: 'extractor', label: '需求提取', icon: PenTool, desc: '分析课程和主题需求' },
  { key: 'searcher', label: '知识检索', icon: Cpu, desc: '检索相关知识点' },
  { key: 'designer', label: '内容设计', icon: Layers, desc: '设计内容结构和形式' },
  { key: 'creator', label: '内容生成', icon: MessageSquare, desc: '生成具体内容' },
  { key: 'reviewer', label: '质量审核', icon: FileCheck, desc: '审核内容准确性' },
  { key: 'formatter', label: '格式编排', icon: FileText, desc: '输出最终格式' },
];

const resourceTypeOptions = [
  { value: 'document', label: '教学案例', icon: FileText, desc: '真实场景案例讲解', color: 'text-primary', available: true },
  { value: 'mindmap', label: '思维导图', icon: Brain, desc: '可视化知识结构', color: 'text-orange-500', available: true },
  { value: 'exercise', label: '练习题', icon: Target, desc: '配套巩固练习', color: 'text-amber-500', available: true },
  { value: 'reading', label: '动画演示', icon: BookOpen, desc: '动态图解知识原理', color: 'text-sky-500', available: true },
  { value: 'code', label: '代码示例', icon: Code, desc: '可运行代码演示', color: 'text-violet-500', available: true },
  { value: 'ppt', label: '课件PPT', icon: Presentation, desc: '自动生成演示文稿', color: 'text-rose-500', available: true },
  { value: 'video', label: '教学短视频', icon: Video, desc: '多模态动画讲解', color: 'text-indigo-500', available: false, tag: '即将上线' },
];

export default function ResourceGeneratePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [topic, setTopic] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [resourceTypes, setResourceTypes] = useState<string[]>(['document']);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  // 附件上传状态
  const [attachments, setAttachments] = useState<{ name: string; type: string; size: number; url?: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const maxSize = 50 * 1024 * 1024; // 50MB
    const valid = files.filter(f => {
      if (f.size > maxSize) { toast.error(`${f.name} 超过50MB限制`); return false; }
      return true;
    });
    setAttachments(prev => [...prev, ...valid.map(f => ({ name: f.name, type: f.type, size: f.size }))]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-3.5 h-3.5 text-sky-500" />;
    if (type.startsWith('video/')) return <Film className="w-3.5 h-3.5 text-violet-500" />;
    return <FileUp className="w-3.5 h-3.5 text-amber-500" />;
  };

  const formatBytes = (b: number) => b < 1024 * 1024 ? `${(b / 1024).toFixed(1)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`;

  const toggleResourceType = (value: string, available: boolean) => {
    if (!available || generating) return;
    setResourceTypes(prev =>
      prev.includes(value)
        ? prev.length === 1 ? prev  // 至少保留一个
          : prev.filter(t => t !== value)
        : [...prev, value]
    );
  };

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error('请填写资源主题'); return; }
    if (!user) { toast.error('请先登录'); return; }
    if (resourceTypes.length === 0) { toast.error('请至少选择一种资源类型'); return; }

    setGenerating(true);
    setProgress(0);
    setCurrentStep(0);
    setLogs([`开始生成 ${resourceTypes.length} 种资源...`]);
    setResult(null);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= agentSteps.length - 1) { clearInterval(stepInterval); return prev; }
        setLogs(l => [...l, `${agentSteps[prev + 1].label} 进行中...`]);
        return prev + 1;
      });
      setProgress(prev => Math.min(prev + Math.floor(85 / resourceTypes.length / agentSteps.length * agentSteps.length), 85));
    }, 1200);

    try {
      const results: { type: string; content: string }[] = [];

      for (let i = 0; i < resourceTypes.length; i++) {
        const rType = resourceTypes[i];
        const typeLabel = resourceTypeOptions.find(t => t.value === rType)?.label || rType;
        setLogs(l => [...l, `正在生成「${typeLabel}」（${i + 1}/${resourceTypes.length}）...`]);

        const data = await generateResource({
          course_name: '',
          topic,
          resource_type: rType,
          major: profile?.major,
          education: profile?.education,
        });

        results.push({ type: rType, content: data.content });

        await supabase.from('resources').insert({
          user_id: user.id,
          title: `${topic} ${typeLabel}`,
          description: `基于AI生成的${typeLabel}资源`,
          type: rType,
          content: data.content,
          status: 'completed',
          course_name: '',
          topic,
          resource_type: rType,
        });

        setProgress(Math.round(((i + 1) / resourceTypes.length) * 100));
      }

      clearInterval(stepInterval);
      setProgress(100);
      setCurrentStep(agentSteps.length - 1);
      setLogs(prev => [...prev, `全部 ${resourceTypes.length} 种资源生成完成！`]);
      // 展示第一种资源的结果
      setResult(results[0]?.content || null);
      toast.success(resourceTypes.length > 1 ? `成功生成 ${resourceTypes.length} 种资源！` : '资源生成成功！');
    } catch (err) {
      clearInterval(stepInterval);
      toast.error('生成失败：' + (err as Error).message);
      setLogs(prev => [...prev, `生成失败：${(err as Error).message}`]);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI资源生成
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 生成配置 */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PenTool className="w-4 h-4 text-primary" />
                生成配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">资源主题</label>
                {/* 课程下拉框 */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => setCourseDropdownOpen(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-muted/30 transition-colors disabled:opacity-50"
                  >
                    <span className={selectedCourse ? 'text-foreground' : 'text-muted-foreground'}>
                      {selectedCourse || '选择课程（可选）'}
                    </span>
                    {courseDropdownOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {courseDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-72 overflow-y-auto"
                      >
                        {/* 清除选择 */}
                        {selectedCourse && (
                          <button
                            type="button"
                            onClick={() => { setSelectedCourse(''); setCourseDropdownOpen(false); }}
                            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/40 border-b border-border"
                          >
                            清除选择
                          </button>
                        )}
                        {COURSE_CATALOG.map(cat => (
                          <div key={cat.category}>
                            <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/30 sticky top-0">
                              {cat.category}
                            </div>
                            {cat.courses.map(course => (
                              <button
                                key={course}
                                type="button"
                                onClick={() => {
                                  setSelectedCourse(course);
                                  if (!topic) setTopic(course);
                                  setCourseDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-muted/40 transition-colors ${selectedCourse === course ? 'text-primary font-medium bg-primary/5' : 'text-foreground'}`}
                              >
                                {course}
                              </button>
                            ))}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Input
                  placeholder="输入具体主题，如：线性回归、二叉树..."
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  disabled={generating}
                />
              </div>

              {/* 附件上传区域 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                  上传参考资料
                  <span className="text-[11px] text-muted-foreground font-normal">（可选）</span>
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                >
                  <Paperclip className="w-4 h-4" />
                  点击上传文档、图片或视频
                </button>
                <p className="text-[11px] text-muted-foreground">支持 PDF/Word/PPT/图片/视频，单文件 ≤ 50MB</p>

                {/* 已上传附件列表 */}
                {attachments.length > 0 && (
                  <div className="space-y-1.5 mt-1">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-xs">
                        {getFileIcon(att.type)}
                        <span className="flex-1 min-w-0 truncate text-foreground">{att.name}</span>
                        <span className="text-muted-foreground shrink-0">{formatBytes(att.size)}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center justify-between">
                  <span>资源类型</span>
                  <span className="text-[11px] font-normal text-muted-foreground">已选 {resourceTypes.length} 种（可多选）</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {resourceTypeOptions.map(opt => {
                    const selected = resourceTypes.includes(opt.value);
                    const isDisabled = generating || !opt.available;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleResourceType(opt.value, opt.available)}
                        disabled={isDisabled}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all relative ${
                          !opt.available
                            ? 'opacity-60 cursor-not-allowed border-border bg-muted/20'
                            : selected
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border hover:bg-muted/50 hover:border-primary/30'
                        }`}
                      >
                        {/* 复选框指示 */}
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          !opt.available ? 'border-muted-foreground/30' : selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                        }`}>
                          {selected && <CheckCircle className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <opt.icon className={`w-4 h-4 shrink-0 ${!opt.available ? 'text-muted-foreground' : selected ? opt.color : 'text-muted-foreground'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${!opt.available ? 'text-muted-foreground' : selected ? 'text-primary' : ''}`}>{opt.label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{opt.desc}</p>
                        </div>
                        {!opt.available && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Lock className="w-3 h-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{opt.tag}</Badge>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !topic.trim() || resourceTypes.length === 0}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    开始生成
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 生成过程 + 结果 */}
          <Card className="lg:col-span-2 flex flex-col min-h-[500px]">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                生成过程
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              <AnimatePresence mode="wait">
                {!generating && !result && !logs.length && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-center p-6"
                  >
                    <Sparkles className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">配置生成参数，点击开始生成</p>
                    <p className="text-xs text-muted-foreground mt-1">系统将通过6个AI智能体协作完成资源生成</p>
                  </motion.div>
                )}

                {(generating || logs.length > 0) && !result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    {/* 进度条 */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>生成进度</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* 步骤 */}
                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                      {agentSteps.map((step, i) => {
                        const isDone = i < currentStep;
                        const isCurrent = i === currentStep && generating;
                        return (
                          <div key={step.key} className={`flex flex-col items-center gap-1 min-w-[60px] ${isDone ? 'opacity-100' : isCurrent ? 'opacity-100' : 'opacity-40'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isDone ? 'bg-primary text-primary-foreground' :
                              isCurrent ? 'bg-secondary text-secondary-foreground ring-2 ring-secondary/50' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {isDone ? <CheckCircle className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                            </div>
                            <span className="text-[10px] truncate w-full text-center">{step.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 日志 */}
                    <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30 rounded-lg p-3 space-y-1.5">
                      {logs.map((log, i) => (
                        <div key={i} className="flex items-center gap-2">
                          {i === logs.length - 1 && generating ? (
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                          ) : (
                            <CheckCircle className="w-3 h-3 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">{log}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge className="bg-primary/10 text-primary border-0">
                        <CheckCircle className="w-3 h-3 mr-1" />生成完成
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/resources')}
                      >
                        <ArrowRight className="w-3 h-3 mr-1" />
                        查看资源
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto rounded-lg space-y-3 p-1">
                      {renderMarkdownBlocks(result)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}