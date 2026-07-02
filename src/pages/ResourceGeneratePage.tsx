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
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { textAIService } from '@/services/ai';
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
  RefreshCw, FileDown, Plus, Trash2, Edit, Search, Calendar,
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
  coverSlide.addText('Kowell AI 生成课件', {
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
      elements.push(<h3 key={i} className="text-sm font-bold mt-3 mb-1 text-white">{renderInline(line.replace(/^### /, ''))}</h3>);
    } else if (/^## /.test(line)) {
      elements.push(<h2 key={i} className="text-sm font-semibold mt-3 mb-1.5 text-primary border-b border-white/10 pb-1">{renderInline(line.replace(/^## /, ''))}</h2>);
    } else if (/^# /.test(line)) {
      elements.push(<h1 key={i} className="text-base font-bold mt-3 mb-2 text-white">{renderInline(line.replace(/^# /, ''))}</h1>);
    } else if (/^\d+\. /.test(line.trimStart())) {
      const num = line.trimStart().match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-primary font-semibold shrink-0 min-w-[1.2rem]">{num}.</span>
          <span className="text-pretty text-white/90">{renderInline(line.trimStart().replace(/^\d+\. /, ''))}</span>
        </div>
      );
    } else if (/^[-*•] /.test(line.trimStart())) {
      elements.push(
        <div key={i} className="flex gap-2 text-sm leading-relaxed">
          <span className="text-primary shrink-0 mt-1">•</span>
          <span className="text-pretty text-white/90">{renderInline(line.trimStart().replace(/^[-*•] /, ''))}</span>
        </div>
      );
    } else if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(
        <div key={i} className="my-2 rounded-lg overflow-hidden border border-white/10">
          {lang && <div className="px-3 py-1 bg-white/5 text-[10px] font-mono text-white/60 border-b border-white/10">{lang}</div>}
          <pre className="px-3 py-2.5 text-xs font-mono leading-relaxed overflow-x-auto bg-white/5 text-white/90"><code>{codeLines.join('\n')}</code></pre>
        </div>
      );
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="my-3 border-white/10" />);
    } else if (/^> /.test(line)) {
      elements.push(<blockquote key={i} className="border-l-2 border-primary/50 pl-3 my-1.5 text-sm text-white/70 italic">{renderInline(line.replace(/^> /, ''))}</blockquote>);
    } else if (line.trim() === '') {
      if (elements.length > 0) elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed text-pretty text-white/95">{renderInline(line)}</p>);
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
    if (match[2]) parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>);
    else if (match[3]) parts.push(<code key={match.index} className="px-1 py-0.5 rounded bg-white/10 text-xs font-mono text-primary">{match[3]}</code>);
    else if (match[4]) parts.push(<em key={match.index}>{match[4]}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

function renderProcessMarkdownBlocks(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#### /.test(line)) {
      elements.push(<h4 key={i} className="text-xs font-semibold mt-2 mb-1 text-emerald-600 dark:text-emerald-400">{renderInline(line.replace(/^#### /, ''))}</h4>);
    } else if (/^### /.test(line)) {
      elements.push(<h3 key={i} className="text-sm font-bold mt-3 mb-1 text-sky-600 dark:text-sky-400">{renderInline(line.replace(/^### /, ''))}</h3>);
    } else if (/^## /.test(line)) {
      elements.push(<h2 key={i} className="text-base font-bold mt-4 mb-1.5 text-indigo-500 border-b border-border/40 pb-1">{renderInline(line.replace(/^## /, ''))}</h2>);
    } else if (/^# /.test(line)) {
      elements.push(<h1 key={i} className="text-lg font-extrabold mt-5 mb-2 text-violet-600 dark:text-violet-400">{renderInline(line.replace(/^# /, ''))}</h1>);
    } else if (/^\d+\. /.test(line.trimStart())) {
      const num = line.trimStart().match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 text-xs leading-relaxed">
          <span className="text-primary font-medium shrink-0 min-w-[1.2rem]">{num}.</span>
          <span className="text-pretty text-muted-foreground">{renderInline(line.trimStart().replace(/^\d+\. /, ''))}</span>
        </div>
      );
    } else if (/^[-*•] /.test(line.trimStart())) {
      elements.push(
        <div key={i} className="flex gap-2 text-xs leading-relaxed">
          <span className="text-primary shrink-0 mt-0.5">•</span>
          <span className="text-pretty text-muted-foreground">{renderInline(line.trimStart().replace(/^[-*•] /, ''))}</span>
        </div>
      );
    } else if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      elements.push(
        <div key={i} className="my-2 rounded-md overflow-hidden border border-border/50">
          {lang && <div className="px-2 py-1 bg-muted/60 text-[9px] font-mono text-muted-foreground border-b border-border/40">{lang}</div>}
          <pre className="px-2 py-2 text-[10px] font-mono leading-relaxed overflow-x-auto bg-muted/30 text-muted-foreground"><code>{codeLines.join('\n')}</code></pre>
        </div>
      );
    } else if (line.trim() === '') {
      if (elements.length > 0) elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-xs leading-relaxed text-pretty text-muted-foreground">{renderInline(line)}</p>);
    }
    i++;
  }
  return <div className="space-y-1">{elements}</div>;
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

const RESOURCE_PROMPTS = {
  document: `你是一位资深的计算机/人工智能教授。请根据用户提供的主题，编写一个深入浅出的【教学案例】。
内容必须包括以下部分：
## 一、案例背景
详细介绍该技术在实际工业界或学术界的应用背景。
## 二、核心原理
用清晰、通俗但精准的语言解释其核心的科学或工程原理，并说明其中的关键公式（若有）。
## 三、算法流程与实现步骤
列出一步步的技术实现流程，要求逻辑严密。
## 四、应用场景
列举2-3个真实场景案例讲解。

要求：内容科学正确，格式排版整齐美观，多用 Markdown 的标题、粗体、列表、代码块、引用等元素进行结构化排版。`,

  mindmap: `你是一位资深的计算机/人工智能教授。请根据用户提供的主题，生成一份【思维导图】结构的 Markdown 文本。
要求使用 Markdown 的列表层级结构来表示思维导图：
# [主题名称]
* 核心知识结构
  * 分支一
    * 细分要点1
    * 细分要点2
  * 分支二
    * 细分要点1

要求层级结构清晰合理，至少有三级节点，文字凝练，能够直观地可视化知识结构。不要包含任何多余的解释、前言或后记，只输出 Markdown 列表结构。`,

  exercise: `你是一位资深的计算机/人工智能教授。请根据用户提供的主题，设计一套【配套巩固练习题】。
包含：
## 一、基础选择题
设计2-3道高质量选择题，带有A/B/C/D选项，并紧接着给出 **【答案解析】**。
## 二、算法填空题或简答题
设计1-2道核心算法填空题或综合简答题，并给出详细的参考答案与解析。

要求：题目切中要害，考查深度适中，解析详尽易懂，使用 Markdown 排版。`,

  reading: `你是一位资深的计算机动画设计师与教授。请根据用户提供的主题，设计一个【动画演示脚本及原理图解】。
包含：
## 一、动画演示设计思路
说明如何用动画逐步展示该知识点的运行机制。
## 二、逐帧画面状态与图解
详细列出 4-6 个关键帧画面：
- **画面帧 1**：[画面内容描述，如初始状态指针位置，节点颜色]
- **画面帧 2**：[动画过渡状态，指针移动，值交换]
...
用生动的文字描述动态图解知识原理。使用 Markdown 排版，格式整齐。`,

  code: `你是一位资深的软件工程师 and 计算机教授。请根据用户提供的主题，编写一个高质量、可运行的【代码示例】。
如果是机器学习或深度学习相关主题，请首选 Python/PyTorch 实现。
必须包含：
- 完整的、逻辑自洽的代码，严禁包含未实现的 placeholder。
- 详细的关键步骤中文注释，帮助学生阅读理解。
- 代码前后使用标准的 \`\`\` 块包裹，并标明语言（如 \`\`\`python）。
- 简短的代码运行说明。

使用 Markdown 进行整齐的排版。`,

  ppt: `你是一位精通微课和系统性教学设计的教授。请根据用户提供的主题，生成一份结构清晰的【课件PPT大纲与文字内容】。
采用 Markdown 格式排版，必须包含 3-4 个幻灯片页面。
每一页必须使用以下格式：
## 第 X 页：[幻灯片标题]
- [要点 1]：[简短描述]
- [要点 2]：[简短描述]
...

要求：结构分明，每页幻灯片的文字简练、突出重点，非常适合自动生成和排版演示文稿。`,

  video: `你是一位优秀的教学短视频编导与计算机教授。请根据用户提供的主题，撰写一份【教学短视频脚本与多模态讲解大纲】。
包含：
## 一、视频基本信息
- 时长：3-5分钟
- 风格：科技感、简洁明快
## 二、分镜头脚本大纲
- **镜头 1**：【画面】[描述画面内容] 【旁白】[解说词]
- **镜头 2**：【画面】[描述画面内容] 【旁白】[解说词]
...
用多模态大纲生动解说该知识点的核心原理。格式排版整齐，适合配音和分镜描述。`
};

export default function ResourceGeneratePage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/resources' || location.state?.showLibrary) {
      setShowMyInterface(true);
    }
  }, [location]);

  const [topic, setTopic] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [resourceTypes, setResourceTypes] = useState<string[]>(['document']);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [activePreviewType, setActivePreviewType] = useState<string>('document');
  const [generatedResults, setGeneratedResults] = useState<Record<string, string>>({});
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

  // 我的界面 (资源管理 CRUD) 相关状态
  const [showMyInterface, setShowMyInterface] = useState(false);
  const [userResources, setUserResources] = useState<any[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeResource, setActiveResource] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    topic: '',
    course_name: '',
    content: '',
    type: 'document'
  });

  const [dbCourses, setDbCourses] = useState<{ id: string; name: string }[]>([]);

  const fetchDbCourses = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('courses').select('id, name');
      if (error) throw error;
      setDbCourses(data || []);
    } catch (err) {
      console.error('获取数据库课程失败:', err);
    }
  }, []);

  useEffect(() => {
    fetchDbCourses();
  }, [fetchDbCourses]);

  const getOrCreateCourseId = async (courseName: string): Promise<string | null> => {
    if (!courseName.trim()) return null;
    try {
      const matched = dbCourses.find(c => c.name.trim() === courseName.trim());
      if (matched) return matched.id;

      const { data: existing, error: findError } = await supabase
        .from('courses')
        .select('id')
        .eq('name', courseName.trim())
        .maybeSingle();
      
      if (findError) throw findError;
      if (existing) return existing.id;

      const { data: newCourse, error: insertError } = await supabase
        .from('courses')
        .insert({
          name: courseName.trim(),
          major: profile?.major || '计算机科学',
          description: `AI自动创建的${courseName}课程`,
        })
        .select('id')
        .single();
      
      if (insertError) throw insertError;
      if (newCourse) {
        fetchDbCourses();
        return newCourse.id;
      }
    } catch (e) {
      console.error('getOrCreateCourseId failed:', e);
    }
    return null;
  };

  const fetchUserResources = useCallback(async () => {
    if (!user) return;
    setLoadingResources(true);
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*, courses(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserResources(data || []);
    } catch (err) {
      toast.error('获取资源失败: ' + (err as Error).message);
    } finally {
      setLoadingResources(false);
    }
  }, [user]);

  useEffect(() => {
    if (showMyInterface) {
      fetchUserResources();
    }
  }, [showMyInterface, fetchUserResources]);

  const handleDeleteResource = async (id: string) => {
    if (!confirm('确定要删除该资源吗？此操作无法撤销。')) return;
    try {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('删除成功！');
      fetchUserResources();
      if (activeResource?.id === id) {
        setActiveResource(null);
        setIsEditing(false);
      }
    } catch (err) {
      toast.error('删除失败: ' + (err as Error).message);
    }
  };

  const startEditResource = (res: any) => {
    setActiveResource(res);
    setIsEditing(true);
    setIsCreatingManual(false);
    setEditForm({
      title: res.title || '',
      topic: res.chapter || (res.tags?.[0] || ''),
      course_name: res.courses?.name || (res.tags?.[1] || ''),
      content: typeof res.content === 'object' ? JSON.stringify(res.content) : (res.content || ''),
      type: res.resource_type || 'document'
    });
  };

  const startCreateManual = () => {
    setIsCreatingManual(true);
    setIsEditing(false);
    setActiveResource(null);
    setEditForm({
      title: '',
      topic: '',
      course_name: '',
      content: '',
      type: 'document'
    });
  };

  const handleSaveResource = async () => {
    if (!editForm.title.trim()) { toast.error('请填写标题'); return; }
    try {
      const courseId = await getOrCreateCourseId(editForm.course_name);
      if (isCreatingManual) {
        if (!user) return;
        const { error } = await supabase
          .from('resources')
          .insert({
            user_id: user.id,
            course_id: courseId,
            title: editForm.title,
            content: editForm.content,
            resource_type: editForm.type,
            status: 'completed',
            source: 'manual',
            tags: [editForm.topic, editForm.course_name].filter(Boolean),
            chapter: editForm.topic || null
          });

        if (error) throw error;
        toast.success('手动创建成功！');
        setIsCreatingManual(false);
      } else if (activeResource) {
        const { error } = await supabase
          .from('resources')
          .update({
            course_id: courseId,
            title: editForm.title,
            content: editForm.content,
            resource_type: editForm.type,
            tags: [editForm.topic, editForm.course_name].filter(Boolean),
            chapter: editForm.topic || null
          })
          .eq('id', activeResource.id);

        if (error) throw error;
        toast.success('保存成功！');
        setIsEditing(false);
      }
      fetchUserResources();
      if (activeResource) {
        setActiveResource((prev: any) => ({
          ...prev,
          title: editForm.title,
          chapter: editForm.topic || null,
          courses: { id: courseId, name: editForm.course_name },
          content: editForm.content,
          resource_type: editForm.type
        }));
      }
    } catch (err) {
      toast.error('保存失败: ' + (err as Error).message);
    }
  };

  const filteredResources = userResources.filter(res => {
    const query = searchQuery.toLowerCase();
    return (
      (res.title || '').toLowerCase().includes(query) ||
      (res.courses?.name || '').toLowerCase().includes(query) ||
      (res.chapter || '').toLowerCase().includes(query)
    );
  });


  const applyExampleTemplate = (ex: typeof STANDARD_EXAMPLES[0]) => {
    setTopic(ex.exampleTopic);
    setResourceTypes([ex.type]);
    setResult(ex.content);
    setGeneratedResults({ [ex.type]: ex.content });
    setActivePreviewType(ex.type);
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

  const [thinkLog, setThinkLog] = useState('');

  const handleGenerate = async () => {
    if (!user) { toast.error('请先登录'); return; }
    if (resourceTypes.length === 0) { toast.error('请至少选择一种资源类型'); return; }

    setGenerating(true);
    setProgress(0);
    setCurrentStep(0);
    setLogs([`开始生成 ${resourceTypes.length} 种资源...`]);
    setResult('');
    setGeneratedResults({});
    setThinkLog('');

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= agentSteps.length - 1) { clearInterval(stepInterval); return prev; }
        setLogs(l => [...l, `${agentSteps[prev + 1].label} 进行中...`]);
        return prev + 1;
      });
      setProgress(prev => Math.min(prev + Math.floor(85 / resourceTypes.length / agentSteps.length * agentSteps.length), 85));
    }, 1200);

    try {
      let activeWebContent = webContent;
      if (webUrl.trim() && !activeWebContent) {
        setLogs(l => [...l, `正在自动抓取网页参考: ${webUrl.trim()} ...`]);
        try {
          const fetched = await fetchWebContent(webUrl.trim());
          activeWebContent = fetched;
          setWebContent(fetched);
          setLogs(l => [...l, `网页抓取成功，已提取 ${fetched.length} 字`]);
        } catch (err) {
          console.error('自动抓取网页失败:', err);
          setLogs(l => [...l, `自动抓取网页失败，将直接生成`]);
        }
      }

      let finalTopic = topic.trim();
      if (!finalTopic) {
        if (attachments.length > 0) {
          finalTopic = attachments[0].name.replace(/\.[^/.]+$/, "");
        } else if (activeWebContent) {
          const cleanLines = activeWebContent.split('\n').map(l => l.trim().replace(/[#*`]/g, '')).filter(Boolean);
          finalTopic = cleanLines[0]?.slice(0, 30) || '网页参考资源';
        } else if (webUrl.trim()) {
          try {
            const parsed = new URL(webUrl);
            finalTopic = parsed.hostname + ' 网页资源';
          } catch {
            finalTopic = '网页参考资源';
          }
        } else {
          clearInterval(stepInterval);
          toast.error('请填写资源主题，或提供网页抓取/上传参考资料');
          setGenerating(false);
          return;
        }
        setTopic(finalTopic);
      }

      const results: { type: string; content: string }[] = [];
      const enrichedTopic = activeWebContent
        ? `${finalTopic}\n\n【参考资料】\n${activeWebContent.slice(0, 2000)}`
        : finalTopic;

      for (let i = 0; i < resourceTypes.length; i++) {
        const rType = resourceTypes[i];
        const typeLabel = resourceTypeOptions.find(t => t.value === rType)?.label || rType;
        setLogs(l => [...l, `正在生成「${typeLabel}」（${i + 1}/${resourceTypes.length}）...`]);
        setActivePreviewType(rType);
        setResult('');

        const systemPrompt = RESOURCE_PROMPTS[rType as keyof typeof RESOURCE_PROMPTS] || "You are a helpful assistant.";
        const userPrompt = `课程名称：${selectedCourse}\n主要专业：${profile?.major || '计算机科学'}\n学历层次：${profile?.education || '本科'}\n生成主题：${enrichedTopic}`;
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: userPrompt }
        ];

        let contentBuffer = '';
        let thinkBuffer = '';
        let isThinking = false;

        await new Promise<void>((resolve, reject) => {
          textAIService.streamResourceGeneration(
            {
              courseName: selectedCourse,
              topic: enrichedTopic,
              resourceType: rType,
              major: profile?.major || '计算机科学',
              education: profile?.education || '本科'
            },
            {
              onChunk: (chunk) => {
                contentBuffer += chunk;
                setResult(contentBuffer);
                setGeneratedResults(prev => ({
                  ...prev,
                  [rType]: contentBuffer
                }));
              },
              onThink: (thinkText) => {
                thinkBuffer += thinkText;
                setThinkLog(prev => prev + thinkText);
              },
              onDone: () => {
                results.push({ type: rType, content: contentBuffer });
                resolve();
              },
              onError: (err) => {
                reject(new Error(err));
              }
            },
            abortRef.current?.signal
          );
        });

        // PPT 类型：客户端生成 .pptx 文件
        if (rType === 'ppt') {
          setLogs(l => [...l, '正在生成 PPT 文件...']);
          try {
            await downloadAsPptx(finalTopic, contentBuffer);
            toast.success('PPT 已自动下载！');
          } catch {
            toast.error('PPT 下载失败，内容已展示在预览区');
          }
        }

        // Save to Supabase
        const courseId = await getOrCreateCourseId(selectedCourse);
        const { error: insertError } = await supabase.from('resources').insert({
          user_id: user.id,
          course_id: courseId,
          title: `${finalTopic} ${typeLabel}`,
          content: contentBuffer,
          status: 'completed',
          resource_type: rType,
          source: 'ai',
          tags: [finalTopic, selectedCourse].filter(Boolean),
          chapter: finalTopic || null,
        });

        if (insertError) {
          console.error('保存生成资源失败:', insertError);
          setLogs(l => [...l, `保存「${typeLabel}」到数据库失败: ${insertError.message}`]);
        } else {
          setLogs(l => [...l, `保存「${typeLabel}」成功`]);
        }

        // If 'video' is selected, trigger Kling video task in background
        if (rType === 'video') {
          setLogs(l => [...l, '启动 Kling 视频生成任务...']);
          (async () => {
            try {
              const taskId = await createVideoTask(`教学动画视频：${enrichedTopic}，画面清晰、专业风格`);
              const url = await pollVideoTask(taskId);
              setVideoUrl(url);
              toast.success('视频文件生成完成！');
            } catch (e) {
              toast.error('可灵视频生成失败：' + (e as Error).message);
            }
          })();
        }

        setProgress(Math.round(((i + 1) / resourceTypes.length) * 100));
      }

      clearInterval(stepInterval);
      setProgress(100);
      setCurrentStep(agentSteps.length - 1);
      setLogs(prev => [...prev, `全部 ${resourceTypes.length} 种资源生成完成！`]);
      
      // Auto select the first resource tab to show after complete
      if (resourceTypes.length > 0) {
        setActivePreviewType(resourceTypes[0]);
        setResult(results[0]?.content || '');
      }
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
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI资源生成
          </h1>
          <button
            onClick={() => setShowMyInterface(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-primary/15 to-purple-500/15 text-primary border border-primary/25 hover:border-primary/60 hover:from-primary/25 hover:to-purple-500/25 transition-all duration-200 hover:scale-105 shadow-sm"
          >
            <Layers className="w-3.5 h-3.5" />
            我的资源
          </button>
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
                  disabled={generating || (!topic.trim() && !webUrl.trim() && attachments.length === 0) || resourceTypes.length === 0}
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

                    {/* 日志与思考过程 */}
                    <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30 rounded-lg p-3 space-y-3">
                      <div className="space-y-1.5">
                        {logs.map((log, i) => (
                          <div key={i} className="flex items-center gap-2">
                            {i === logs.length - 1 && generating && !thinkLog ? (
                              <Loader2 className="w-3 h-3 animate-spin text-primary" />
                            ) : (
                              <CheckCircle className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground">{log}</span>
                          </div>
                        ))}
                      </div>
                      
                      {thinkLog && (
                        <div className="pt-2 border-t border-border/50">
                          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
                            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Brain className="w-3.5 h-3.5" />}
                            AI 深度思考过程...
                          </div>
                          {renderProcessMarkdownBlocks(thinkLog)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex-1 flex flex-col min-h-0"
                  >
                    {/* Mini Progress Bar during Generation */}
                    {generating && (
                      <div className="mb-3 shrink-0">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>正在生成第 {resourceTypes.indexOf(activePreviewType) + 1}/{resourceTypes.length} 种资源</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-1" />
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <Badge className="bg-primary/10 text-primary border-0">
                        {generating ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            正在生成「{resourceTypeOptions.find(o => o.value === activePreviewType)?.label || activePreviewType}」...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            生成完成
                          </>
                        )}
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
                      </div>
                    </div>

                    {/* Tab Switcher for Multiple Resource Types */}
                    {resourceTypes.length > 1 && (
                      <div className="flex gap-1.5 mb-3 border-b border-border/40 pb-2 overflow-x-auto shrink-0 scrollbar-none">
                        {resourceTypes.map(rType => {
                          const opt = resourceTypeOptions.find(o => o.value === rType);
                          const isSelected = activePreviewType === rType;
                          const hasContent = !!generatedResults[rType];
                          return (
                            <button
                              key={rType}
                              type="button"
                              onClick={() => {
                                setActivePreviewType(rType);
                                setResult(generatedResults[rType] || '');
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all shrink-0 ${
                                isSelected
                                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                  : 'border-border/60 bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                              }`}
                            >
                              {opt && <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} />}
                              <span>{opt?.label || rType}</span>
                              {hasContent && !generating && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

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

      {/* ── 我的资源 Dialog ─────────────────────────────────── */}
      <Dialog open={showMyInterface} onOpenChange={(v) => { setShowMyInterface(v); if (!v) { setActiveResource(null); setIsEditing(false); setIsCreatingManual(false); } }}>
        <DialogContent className="max-w-[1100px] w-[96vw] h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl border-0 shadow-2xl bg-[#0f1117]">

          {/* ── 顶部渐变标题栏 */}
          <div className="relative shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 opacity-90" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
            <div className="relative flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm">
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <DialogTitle className="text-base font-bold text-white leading-tight">
                      我的资源库
                    </DialogTitle>
                    <button
                      onClick={startCreateManual}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-white/20 hover:bg-white/30 text-white border border-white/25 hover:border-white/50 transition-all duration-200 backdrop-blur-sm hover:scale-105 shadow-lg shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      新建资源
                    </button>
                  </div>
                  <DialogDescription className="text-[11px] text-white/80 mt-0.5">
                    管理您所有 AI 生成与手动创建的教学资源
                  </DialogDescription>
                </div>
              </div>
            </div>
          </div>

          {/* ── 主体双栏 */}
          <div className="flex-1 flex min-h-0">

            {/* 左栏：搜索 + 列表 */}
            <div className="w-72 shrink-0 flex flex-col border-r border-white/8 bg-[#13161f]">

              {/* 搜索栏 */}
              <div className="p-3 border-b border-white/8">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input
                    placeholder="搜索资源标题、课程..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* 计数 */}
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[10px] text-white/60 font-medium">
                  {filteredResources.length} 个资源
                </span>
                <button onClick={fetchUserResources} className="text-white/30 hover:text-primary transition-colors">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>

              {/* 列表 */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                {loadingResources ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-[11px] text-white/40">加载中...</span>
                  </div>
                ) : filteredResources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                    <div className="p-3 rounded-2xl bg-white/5">
                      <FileText className="w-6 h-6 text-white/20" />
                    </div>
                    <p className="text-[11px] text-white/30">暂无资源，点击右上角"新建资源"</p>
                  </div>
                ) : (
                  filteredResources.map((res) => {
                    const opt = resourceTypeOptions.find(o => o.value === res.resource_type);
                    const isSelected = activeResource?.id === res.id;
                    return (
                      <div
                        key={res.id}
                        onClick={() => { setActiveResource(res); setIsEditing(false); setIsCreatingManual(false); }}
                        className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'bg-gradient-to-r from-primary/20 to-purple-500/10 border border-primary/40 shadow-lg shadow-primary/10'
                            : 'border border-transparent hover:bg-white/5 hover:border-white/10'
                        }`}
                      >
                        {isSelected && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-full" />}
                        <div className="flex items-start gap-2.5">
                          <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-primary/20' : 'bg-white/8'}`}>
                            {opt ? <opt.icon className={`w-3.5 h-3.5 ${opt.color}`} /> : <FileText className="w-3.5 h-3.5 text-white/40" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold truncate ${isSelected ? 'text-primary font-bold' : 'text-white'}`}>
                              {res.title || '无标题'}
                            </p>
                            {(res.courses?.name || res.chapter) && (
                              <p className="text-[10px] text-white/65 truncate mt-0.5">
                                {[res.courses?.name, res.chapter].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-1.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${isSelected ? 'bg-primary/20 text-primary' : 'bg-white/12 text-white/70'}`}>
                                {opt?.label || '文档'}
                              </span>
                              <span className="text-[9px] text-white/50">
                                {res.created_at ? new Date(res.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 右栏：详情 / 编辑 / 新建 */}
            <div className="flex-1 flex flex-col bg-[#0f1117] overflow-hidden">

              {isCreatingManual || isEditing ? (
                /* ── 新建 / 编辑表单 */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* 表单顶栏 */}
                  <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/8">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/15">
                        {isCreatingManual ? <Plus className="w-4 h-4 text-primary" /> : <Edit className="w-4 h-4 text-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{isCreatingManual ? '新建资源' : '编辑资源'}</p>
                        <p className="text-[10px] text-white/35">{isCreatingManual ? '填写信息后点击保存创建' : `修改「${activeResource?.title}」`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setIsEditing(false); setIsCreatingManual(false); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/8 transition-all border border-white/10"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveResource}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 text-white transition-all hover:scale-105 shadow-lg shadow-primary/25"
                      >
                        保存资源
                      </button>
                    </div>
                  </div>

                  {/* 表单内容 */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: '资源标题 *', key: 'title', placeholder: '例如: 快速排序算法多维度分析' },
                        { label: '所属课程', key: 'course_name', placeholder: '例如: 数据结构与算法' },
                        { label: '学习主题', key: 'topic', placeholder: '例如: 快速排序' },
                      ].map(({ label, key, placeholder }) => (
                        <div key={key} className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-white/45 uppercase tracking-wider">{label}</label>
                          <input
                            value={editForm[key as keyof typeof editForm]}
                            onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                            placeholder={placeholder}
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)' }}
                            className="w-full px-3 py-2 text-xs rounded-lg focus:outline-none transition-all"
                          />
                        </div>
                      ))}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-white/45 uppercase tracking-wider">资源类型</label>
                        <select
                          value={editForm.type}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                          style={{ background: '#1a1d2a', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.12)' }}
                          className="w-full px-3 py-2 text-xs rounded-lg focus:outline-none transition-all appearance-none"
                        >
                          {resourceTypeOptions.map((opt) => (
                            <option key={opt.value} value={opt.value} style={{ background: '#1a1d2a', color: '#e2e8f0' }}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <label className="text-[11px] font-semibold text-white/45 uppercase tracking-wider">
                        资源内容 <span className="text-white/25 normal-case font-normal">（支持 Markdown 语法）</span>
                      </label>
                      <textarea
                        value={editForm.content}
                        onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                        placeholder="# 标题&#10;&#10;在这里编写资源正文，支持 Markdown 标题、列表、**粗体**、`代码`、代码块等..."
                        style={{ background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.09)', minHeight: '340px' }}
                        className="w-full px-4 py-3 text-xs font-mono rounded-xl focus:outline-none transition-all resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

              ) : activeResource ? (
                /* ── 详情预览 */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* 详情顶栏 */}
                  <div className="shrink-0 px-6 py-4 border-b border-white/8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {(() => {
                            const opt = resourceTypeOptions.find(o => o.value === activeResource.resource_type);
                            return opt ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/8 ${opt.color}`}>
                                <opt.icon className="w-3 h-3" />{opt.label}
                              </span>
                            ) : null;
                          })()}
                          <span className="text-[10px] text-white/50">
                            {activeResource.created_at ? new Date(activeResource.created_at).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white leading-tight truncate">
                          {activeResource.title}
                        </h3>
                        {(activeResource.courses?.name || activeResource.chapter) && (
                          <p className="text-[11px] text-white/70 mt-1">
                            {[activeResource.courses?.name, activeResource.chapter].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* 导出/生成功能 */}
                        <button
                          onClick={() => downloadAsDocx(activeResource.title || '资源', activeResource.content || '').catch(() => toast.error('DOCX 下载失败'))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 hover:border-blue-500/40 transition-all"
                        >
                          <FileDown className="w-3.5 h-3.5" />Word
                        </button>
                        <button
                          onClick={() => {
                            setTopic(activeResource.title || '');
                            handleGenerateImage();
                            setShowMyInterface(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
                        >
                          <ImageIcon2 className="w-3.5 h-3.5" />配图
                        </button>
                        <button
                          onClick={() => {
                            setTopic(activeResource.title || '');
                            handleGenerateVideo();
                            setShowMyInterface(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 hover:border-pink-500/40 transition-all"
                        >
                          <Film className="w-3.5 h-3.5" />视频
                        </button>
                        
                        <div className="w-px h-4 bg-white/10 mx-1"></div>

                        <button
                          onClick={() => startEditResource(activeResource)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/80 hover:text-white bg-white/6 hover:bg-white/12 border border-white/10 hover:border-white/20 transition-all"
                        >
                          <Edit className="w-3.5 h-3.5" />编辑
                        </button>
                        <button
                          onClick={() => handleDeleteResource(activeResource.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/70 hover:text-red-400 bg-red-500/6 hover:bg-red-500/12 border border-red-500/15 hover:border-red-500/30 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />删除
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Markdown 内容 */}
                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-3xl mx-auto bg-white/5 border border-white/12 rounded-2xl p-6 shadow-xl text-slate-100">
                      <div className="prose prose-invert prose-sm max-w-none text-slate-100 dark:text-slate-100">
                        {renderMarkdownBlocks(activeResource.content || '')}
                      </div>
                    </div>
                  </div>
                </div>

              ) : (
                /* ── 空状态 */
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <div className="relative mb-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-primary/20">
                      <Layers className="w-8 h-8 text-primary/60" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white/70 mb-2">选择一个资源开始查看</h3>
                  <p className="text-xs text-white/35 max-w-[260px] leading-relaxed">
                    从左侧列表选择资源预览内容，或点击右上角"新建资源"手动添加教学资料
                  </p>
                  <button
                    onClick={startCreateManual}
                    className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-primary/80 to-purple-500/80 hover:from-primary hover:to-purple-500 text-white transition-all hover:scale-105 shadow-lg shadow-primary/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    新建第一个资源
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
