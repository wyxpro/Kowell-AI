import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// 资源生成页
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { generateResource } from '@/lib/ai';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, FileText, Brain, Target, BookOpen, Code, ArrowRight, Loader2,
  CheckCircle, PenTool, Cpu, MessageSquare, FileCheck, Layers,
  Video, Presentation, Lock, Paperclip, X, ImageIcon, Film, FileUp,
  ChevronDown, ChevronUp, Link2, Download, Image as ImageIcon2, Play,
  RefreshCw, FileDown,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────
   生成 PPT（客户端 pptxgenjs）
────────────────────────────────────────────────────────────── */
async function downloadAsPptx(topic: string, content: string) {
  const pptxgen = (await import('pptxgenjs')).default;
  const prs = new pptxgen();
  prs.layout = 'LAYOUT_WIDE';

  // 封面页
  const coverSlide = prs.addSlide();
  coverSlide.background = { color: '6D28D9' };
  coverSlide.addText(topic, {
    x: 0.5, y: 1.5, w: '90%', h: 1.5,
    fontSize: 36, color: 'FFFFFF', bold: true, align: 'center',
  });
  coverSlide.addText('智学伴 AI 生成课件', {
    x: 0.5, y: 3.5, w: '90%', h: 0.6,
    fontSize: 16, color: 'EDE9FE', align: 'center',
  });

  // 将内容按段落拆成多张内容页
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
  const chunks: string[][] = [];
  let current: string[] = [];
  for (const p of paragraphs) {
    current.push(p.trim());
    if (current.length >= 4) { chunks.push(current); current = []; }
  }
  if (current.length) chunks.push(current);

  chunks.forEach((chunk, idx) => {
    const slide = prs.addSlide();
    slide.addText(`${idx + 1}. ${topic}`, {
      x: 0.5, y: 0.3, w: '90%', h: 0.7,
      fontSize: 20, bold: true, color: '4C1D95',
    });
    slide.addText(chunk.join('\n\n'), {
      x: 0.5, y: 1.2, w: '90%', h: 4.5,
      fontSize: 14, color: '1F2937', valign: 'top',
    });
  });

  await prs.writeFile({ fileName: `${topic}-课件.pptx` });
}

/* ──────────────────────────────────────────────────────────────
   生成 DOCX（客户端 docx）
────────────────────────────────────────────────────────────── */
async function downloadAsDocx(topic: string, content: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const paragraphs = content.split('\n').filter(l => l.trim());
  const children = paragraphs.map(line => {
    if (line.startsWith('# ')) return new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 });
    if (line.startsWith('## ')) return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 });
    if (line.startsWith('### ')) return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 });
    return new Paragraph({ children: [new TextRun({ text: line, size: 24 })] });
  });

  const doc = new Document({
    sections: [{ properties: {}, children: [
      new Paragraph({ text: topic, heading: HeadingLevel.TITLE }),
      new Paragraph({ text: '' }),
      ...children,
    ]}],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${topic}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ──────────────────────────────────────────────────────────────
   图片生成（image-generations Edge Function）
────────────────────────────────────────────────────────────── */
async function generateImage(prompt: string): Promise<string[]> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-generations`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ prompt, aspect_ratio: '16:9', n: 1 }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  // 返回 urls 数组
  return (data.data ?? []).map((item: { url?: string; b64_json?: string }) =>
    item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '')
  ).filter(Boolean);
}

/* ──────────────────────────────────────────────────────────────
   网页内容抓取（web-reader Edge Function）
────────────────────────────────────────────────────────────── */
async function fetchWebContent(webUrl: string): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/web-reader`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ url: webUrl }),
  });
  if (!resp.ok) throw new Error('网页抓取失败');
  const data = await resp.json();
  return data.content ?? '';
}

/* ──────────────────────────────────────────────────────────────
   视频生成（kling-video-create + kling-video-query）
────────────────────────────────────────────────────────────── */
async function createVideoTask(prompt: string): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-video-create`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ prompt, duration: 5, aspect_ratio: '16:9' }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.data?.task_id ?? data.task_id ?? '';
}

async function pollVideoTask(taskId: string, maxAttempts = 60): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kling-video-query`;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    });
    if (!resp.ok) continue;
    const data = await resp.json();
    const status = data.data?.task_status ?? data.task_status;
    if (status === 'succeed') {
      return data.data?.task_result?.videos?.[0]?.url ?? '';
    }
    if (status === 'failed') throw new Error('视频生成失败');
  }
  throw new Error('视频生成超时，请稍后重试');
}

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

// 示例主题与高标准生成内容
const STANDARD_EXAMPLES = [
  {
    type: 'document',
    title: '教学案例',
    desc: '真实场景案例讲解',
    exampleTopic: '双目视觉测距系统原理与设计',
    content: `# 双目视觉测距系统原理与设计

## 一、案例背景
在自动驾驶与机器人导航中，精准测量前方障碍物距离是避障决策的核心。本案例介绍基于双目摄像头几何模型的测距系统。

## 二、核心原理
双目测距类似于人类的双眼：
1. **基线距离 (Baseline, B)**: 两摄像头物理中心点间距（一般为 60-120mm）。
2. **焦距 (Focal Length, f)**: 两相同规格相机的焦距。
3. **视差 (Disparity, d)**: 同一空间点在左右相机图像中的横坐标之差 $d = x_l - x_r$。
4. **距离公式**: 根据相似三角形，深度距离 $Z = (B \\times f) / d$。

## 三、算法流程
1. 双目标定 (Stereo Calibration) 获取内外参。
2. 双目校正 (Stereo Rectification) 将成像面调整为平行且共面。
3. 立体匹配 (Stereo Matching) 计算每个像素的视差值。
4. 深度图生成与测距计算。`,
  },
  {
    type: 'mindmap',
    title: '思维导图',
    desc: '可视化知识结构',
    exampleTopic: '深度学习核心网络架构演进',
    content: `# 深度学习核心网络架构演进

* 深度学习网络架构
  * 卷积神经网络 (CNN)
    * LeNet-5 (奠基作)
    * AlexNet (突破性进展，引入ReLU/Dropout)
    * VGG (3x3小卷积核堆叠)
    * ResNet (残差连接，解决梯度消失)
  * 循环神经网络 (RNN)
    * 经典RNN (短时记忆问题)
    * LSTM (长短期记忆，门控机制)
    * GRU (简化版LSTM，更新门/重置门)
  * Transformer (注意力机制)
    * Self-Attention (自注意力自并行)
    * Multi-Head Attention (多头提取多维度特征)
    * Encoder-Decoder (Seq2Seq经典架构)`,
  },
  {
    type: 'exercise',
    title: '练习题',
    desc: '配套巩固练习',
    exampleTopic: '二叉树遍历与递归深度计算',
    content: `# 二叉树遍历与递归深度计算配套练习

### 题目一：基础选择题
1. 若一棵二叉树的前序遍历序列为 ABC，则该二叉树不可能的后序遍历序列是：
   A. CBA  B. BCA  C. CAB  D. ABC
   **答案解析**：答案为 D。若前序是 ABC，A必定是根节点。在后序遍历中根节点必定在最后输出，因此 A 必须在最后，排除 D。

### 题目二：算法填空题
写出计算二叉树最大深度递归算法的伪代码：
\`\`\`python
def maxDepth(root):
    if root is None:
        return 0
    left_depth = maxDepth(root.left)
    right_depth = maxDepth(root.right)
    return max(left_depth, right_depth) + 1
\`\`\``,
  },
  {
    type: 'reading',
    title: '动画演示',
    desc: '动态图解知识原理',
    exampleTopic: '快速排序(Quick Sort)双指针分区动画原理',
    content: `# 快速排序双指针分区动画原理

## 一、动画演示设计思路
本动画主要演示快速排序中最核心的 **Pivot 分区**（双指针法）过程。

## 二、状态帧与图解
1. **初始状态**：数组 \`[4, 2, 6, 5, 3, 9]\`。选择第一个数 \`4\` 作为基准值 (Pivot)。
2. **指针初始化**：左指针 \`i\` 指向左侧第一个元素，右指针 \`j\` 指向右侧最后一个元素。
3. **右指针左移**：\`j\` 从右向左移动，寻找小于基准 \`4\` 的数。在 \`3\` 处停下。
4. **左指针右移**：\`i\` 从左向右移动，寻找大于基准 \`4\` 的数。在 \`6\` 处停下。
5. **交换位置**：交换 \`i\` 与 \`j\` 指向的值，数组变为 \`[4, 2, 3, 5, 6, 9]\`。
6. **相遇与基准归位**：当指针 \`i\` 与 \`j\` 相遇时，将基准值与相遇点的值交换，首轮分区结束。`,
  },
  {
    type: 'code',
    title: '代码示例',
    desc: '可运行代码演示',
    exampleTopic: 'Python 实现多路感知注意力机制',
    content: `# Python 实现多路感知注意力机制

下面是基于 PyTorch 框架的多头自注意力机制 (Multi-Head Self-Attention) 的完整实现：

\`\`\`python
import torch
import torch.nn as nn
import math

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model, num_heads):
        super().__init__()
        assert d_model % num_heads == 0
        self.d_k = d_model // num_heads
        self.h = num_heads
        
        self.q_linear = nn.Linear(d_model, d_model)
        self.k_linear = nn.Linear(d_model, d_model)
        self.v_linear = nn.Linear(d_model, d_model)
        self.out_linear = nn.Linear(d_model, d_model)
        
    def forward(self, q, k, v, mask=None):
        bs = q.size(0)
        # 线性映射并分头
        q = self.q_linear(q).view(bs, -1, self.h, self.d_k).transpose(1, 2)
        k = self.k_linear(k).view(bs, -1, self.h, self.d_k).transpose(1, 2)
        v = self.v_linear(v).view(bs, -1, self.h, self.d_k).transpose(1, 2)
        
        # 计算注意力得分
        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(self.d_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, -1e9)
        attn = torch.softmax(scores, dim=-1)
        
        # 加权求和
        output = torch.matmul(attn, v)
        output = output.transpose(1, 2).contiguous().view(bs, -1, self.h * self.d_k)
        return self.out_linear(output)
\`\`\``,
  },
  {
    type: 'ppt',
    title: '课件PPT',
    desc: '自动生成演示文稿',
    exampleTopic: '区块链技术之共识机制演进',
    content: `# 区块链技术之共识机制演进

## 第一页：区块链共识机制概述
* 什么是共识机制？
  * 在分布式系统中实现各节点账本数据一致的机制。
  * 解决拜占庭将军问题（防篡改、防作恶）。
* 核心指标：安全性、去中心化程度、交易吞吐量 (TPS)。

## 第二页：PoW 工作量证明 (Proof of Work)
* 原理：节点通过哈希碰撞计算数学难题来争夺记账权。
* 优点：安全性高，抗攻击力强，完全去中心化。
* 缺点：能耗极大（算力竞赛），TPS较低。

## 第三页：PoS 权益证明 (Proof of Stake)
* 原理：根据持有代币的币龄和数量来按比例分配记账权。
* 优点：节能，TPS较高，不容易受到51%算力攻击。
* 缺点：易导致“富者愈富”的中心化趋势。`,
  },
  {
    type: 'video',
    title: '教学短视频',
    desc: '多模态动画讲解',
    exampleTopic: '三分钟看懂大语言模型生成原理',
    content: `# 三分钟看懂大语言模型生成原理

* 本短视频主要通过动画解说大模型的**Next-Token Prediction（下一个Token预测）**工作流。
* **画面帧 1**：输入提示词 "人工智能的未来是"，AI 将其切分为单词 Token。
* **画面帧 2**：Token 经过 Transformer Encoder 转化为嵌入高维向量。
* **画面帧 3**：经过多层自注意力机制进行语义关联加权。
* **画面帧 4**：输出概率分布，选择概率最高或符合抽样温度的词 "光明"，完成单步预测并送回输入端循环生成。`,
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
  { value: 'video', label: '教学短视频', icon: Video, desc: '多模态动画讲解', color: 'text-indigo-500', available: true, tag: '' },
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
  // 网页 URL 输入
  const [webUrl, setWebUrl] = useState('');
  const [webFetching, setWebFetching] = useState(false);
  const [webContent, setWebContent] = useState('');
  // 图片生成结果
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imageGenerating, setImageGenerating] = useState(false);
  // 视频生成结果
  const [videoUrl, setVideoUrl] = useState('');
  const [videoGenerating, setVideoGenerating] = useState(false);
  // 附件上传状态
  const [attachments, setAttachments] = useState<{ name: string; type: string; size: number; url?: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [previewExample, setPreviewExample] = useState<typeof STANDARD_EXAMPLES[0] | null>(null);

  const applyExampleTemplate = (ex: typeof STANDARD_EXAMPLES[0]) => {
    setTopic(ex.exampleTopic);
    setResourceTypes([ex.type]);
    setResult(ex.content);
    setPreviewExample(null);
    toast.success(`已应用「${ex.title}」标准模板！已填充示例主题，可以直接在右侧预览或下载。`);
  };

  // ── 抓取网页内容 ──────────────────────────────────────────
  const handleFetchWeb = useCallback(async () => {
    if (!webUrl.trim()) { toast.error('请填写网页 URL'); return; }
    setWebFetching(true);
    try {
      const content = await fetchWebContent(webUrl.trim());
      setWebContent(content);
      toast.success('网页内容已提取，将作为生成参考');
    } catch {
      toast.error('网页抓取失败，请检查 URL');
    } finally {
      setWebFetching(false);
    }
  }, [webUrl]);

  // ── 生成配图 ──────────────────────────────────────────────
  const handleGenerateImage = useCallback(async () => {
    if (!topic.trim()) { toast.error('请先填写资源主题'); return; }
    setImageGenerating(true);
    try {
      const imgs = await generateImage(`教学配图：${topic}，清晰、专业、适合课件使用`);
      setGeneratedImages(imgs);
      toast.success('配图生成成功！');
    } catch (e) {
      toast.error('图片生成失败：' + (e as Error).message);
    } finally {
      setImageGenerating(false);
    }
  }, [topic]);

  // ── 生成教学视频 ──────────────────────────────────────────
  const handleGenerateVideo = useCallback(async () => {
    if (!topic.trim()) { toast.error('请先填写资源主题'); return; }
    setVideoGenerating(true);
    setVideoUrl('');
    toast.info('视频生成中，预计需要 1-3 分钟...');
    try {
      const taskId = await createVideoTask(
        `教学动画视频：${topic}，内容专业、画面清晰、适合高校课堂，风格现代简洁`
      );
      const url = await pollVideoTask(taskId);
      setVideoUrl(url);
      toast.success('视频生成完成！');
    } catch (e) {
      toast.error('视频生成失败：' + (e as Error).message);
    } finally {
      setVideoGenerating(false);
    }
  }, [topic]);

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
      // 如有网页内容，注入到 topic 提示词中
      const enrichedTopic = webContent
        ? `${topic}\n\n【参考资料】\n${webContent.slice(0, 2000)}`
        : topic;

      for (let i = 0; i < resourceTypes.length; i++) {
        const rType = resourceTypes[i];
        const typeLabel = resourceTypeOptions.find(t => t.value === rType)?.label || rType;
        setLogs(l => [...l, `正在生成「${typeLabel}」（${i + 1}/${resourceTypes.length}）...`]);

        // 视频类型走 kling，不调 ai-generate
        if (rType === 'video') {
          setLogs(l => [...l, '启动 Kling 视频生成任务...']);
          try {
            const taskId = await createVideoTask(`教学动画视频：${enrichedTopic}，画面清晰、专业风格`);
            const url = await pollVideoTask(taskId);
            setVideoUrl(url);
            results.push({ type: 'video', content: url });
            await supabase.from('resources').insert({
              user_id: user.id, title: `${topic} 教学视频`,
              description: '由可灵AI生成的教学视频', type: 'video',
              content: url, status: 'completed',
              course_name: selectedCourse, topic, resource_type: 'video',
            });
          } catch (e) {
            setLogs(l => [...l, `视频生成失败：${(e as Error).message}`]);
            toast.error('视频生成失败：' + (e as Error).message);
          }
          setProgress(Math.round(((i + 1) / resourceTypes.length) * 100));
          continue;
        }

        const data = await generateResource({
          course_name: selectedCourse,
          topic: enrichedTopic,
          resource_type: rType,
          major: profile?.major,
          education: profile?.education,
        });

        results.push({ type: rType, content: data.content });

        // PPT 类型：客户端生成 .pptx 文件
        if (rType === 'ppt') {
          setLogs(l => [...l, '正在生成 PPT 文件...']);
          try {
            await downloadAsPptx(topic, data.content);
            toast.success('PPT 已自动下载！');
          } catch {
            toast.error('PPT 下载失败，内容已展示在预览区');
          }
        }

        await supabase.from('resources').insert({
          user_id: user.id,
          title: `${topic} ${typeLabel}`,
          description: `基于AI生成的${typeLabel}资源`,
          type: rType,
          content: data.content,
          status: 'completed',
          course_name: selectedCourse,
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

        {/* 生成标准示例 - 桌面端横向排版 */}
        <Card className="hidden md:block border border-border/80 bg-card/40 backdrop-blur-sm shadow-sm">
          <CardContent className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="shrink-0 max-w-[220px]">
              <h2 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                <FileCheck className="w-4 h-4 text-primary" />
                生成标准示例
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                点击预览并快捷应用高标准教学资源模板
              </p>
            </div>
            
            <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {STANDARD_EXAMPLES.map(ex => {
                const opt = resourceTypeOptions.find(o => o.value === ex.type);
                if (!opt) return null;
                return (
                  <motion.div
                    key={ex.type}
                    whileHover={{ y: -2 }}
                    className="p-2 rounded-xl border border-border/60 bg-background/50 hover:bg-muted/40 hover:border-primary/30 transition-all cursor-pointer flex items-center gap-2 select-none"
                    onClick={() => setPreviewExample(ex)}
                  >
                    <div className="p-1 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-foreground truncate">{ex.title}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{ex.exampleTopic}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

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

              {/* 网页内容抓取 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                  抓取网页参考
                  <span className="text-[11px] text-muted-foreground font-normal">（可选）</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="粘贴网页 URL..."
                    value={webUrl}
                    onChange={e => setWebUrl(e.target.value)}
                    disabled={generating || webFetching}
                    className="flex-1 text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={handleFetchWeb} disabled={generating || webFetching || !webUrl.trim()} className="shrink-0">
                    {webFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                {webContent && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />已提取 {webContent.length} 字，将作为生成参考
                  </p>
                )}
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

                {/* 开始生成按钮，紧靠资源类型 label 下方显示 */}
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !topic.trim() || resourceTypes.length === 0}
                  className="w-full mt-4 mb-5 shadow-lg shadow-indigo-500/20 font-semibold py-5 text-sm bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white border-0 transition-all duration-300 hover:scale-[1.01]"
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
            </CardContent>
          </Card>

          {/* 生成过程 + 结果 */}
          <Card className="lg:col-span-2 xl:col-span-2 flex flex-col min-h-[500px]">
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
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <Badge className="bg-primary/10 text-primary border-0">
                        <CheckCircle className="w-3 h-3 mr-1" />生成完成
                      </Badge>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* DOCX 下载 */}
                        {result && (
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                            onClick={() => downloadAsDocx(topic, result).catch(() => toast.error('DOCX 下载失败'))}>
                            <FileDown className="w-3 h-3" />Word
                          </Button>
                        )}
                        {/* 生成配图 */}
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                          disabled={imageGenerating || !topic.trim()}
                          onClick={handleGenerateImage}>
                          {imageGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon2 className="w-3 h-3" />}
                          配图
                        </Button>
                        {/* 生成视频 */}
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                          disabled={videoGenerating || !topic.trim()}
                          onClick={handleGenerateVideo}>
                          {videoGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          视频
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                          onClick={() => navigate('/resources')}>
                          <ArrowRight className="w-3 h-3" />查看资源
                        </Button>
                      </div>
                    </div>

                    {/* 生成的图片 */}
                    {generatedImages.length > 0 && (
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        {generatedImages.map((src, i) => (
                          <div key={i} className="relative group rounded-lg overflow-hidden border border-border">
                            <img src={src} alt={`配图${i + 1}`} className="w-full aspect-video object-cover" />
                            <a href={src} download={`${topic}-配图${i + 1}.png`}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Download className="w-5 h-5 text-white" />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    {imageGenerating && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />AI 正在生成配图...
                      </div>
                    )}

                    {/* 生成的视频 */}
                    {videoUrl && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-border bg-black">
                        <video src={videoUrl} controls className="w-full max-h-48" />
                        <div className="flex justify-end p-2 bg-muted/30">
                          <a href={videoUrl} download={`${topic}-教学视频.mp4`}
                            className="text-xs text-primary flex items-center gap-1 hover:underline">
                            <Download className="w-3 h-3" />下载视频
                          </a>
                        </div>
                      </div>
                    )}
                    {videoGenerating && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                        <span>可灵AI 视频生成中，预计 1-3 分钟...</span>
                      </div>
                    )}

                    <div className="flex-1 min-h-0 overflow-y-auto rounded-lg space-y-3 p-1">
                      {renderMarkdownBlocks(result)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* 生成标准示例 - 移动端最下面显示 */}
          <Card className="block md:hidden border border-border mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-primary" />
                生成标准示例
              </CardTitle>
              <p className="text-[10px] text-muted-foreground">
                点击预览并快捷应用高标准教学资源模板
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 p-3 pt-0">
              {STANDARD_EXAMPLES.map(ex => {
                const opt = resourceTypeOptions.find(o => o.value === ex.type);
                if (!opt) return null;
                return (
                  <motion.div
                    key={ex.type}
                    whileHover={{ y: -1 }}
                    className="p-2 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer flex flex-col gap-0.5 select-none"
                    onClick={() => setPreviewExample(ex)}
                  >
                    <div className="flex items-center gap-1.5">
                      <opt.icon className={`w-3 h-3 shrink-0 ${opt.color}`} />
                      <span className="text-[10px] font-bold text-foreground truncate">{ex.title}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate">{ex.exampleTopic}</p>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 示例预览与应用 Dialog */}
      <Dialog open={previewExample !== null} onOpenChange={(open) => !open && setPreviewExample(null)}>
        {previewExample && (
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                {(() => {
                  const opt = resourceTypeOptions.find(o => o.value === previewExample.type);
                  return (
                    <>
                      {opt && <opt.icon className={`w-5 h-5 ${opt.color}`} />}
                      <span>{previewExample.title} 标准示例</span>
                    </>
                  );
                })()}
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                主题：<span className="font-semibold text-foreground">{previewExample.exampleTopic}</span>
              </DialogDescription>
            </DialogHeader>

            {/* Markdown 预览 */}
            <div className="flex-1 overflow-y-auto my-4 border border-border/60 rounded-xl p-4 bg-muted/20">
              {renderMarkdownBlocks(previewExample.content)}
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border/40 pt-4 gap-4">
              <span className="text-xs text-muted-foreground text-left max-w-[320px]">
                应用此示例将自动填充主题，并显示标准输出结果。
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setPreviewExample(null)}>
                  关闭
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => applyExampleTemplate(previewExample)}>
                  <Sparkles className="w-3.5 h-3.5" />
                  应用此模板
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </AppLayout>
  );
}