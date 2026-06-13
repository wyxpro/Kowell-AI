import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Network, Sparkles, Plus, X, ZoomIn, ZoomOut, RotateCcw,
  BookOpen, Layers, Link, ChevronRight, Cpu, Loader2,
} from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  type: 'core' | 'primary' | 'secondary' | 'leaf';
  description: string;
  x: number;
  y: number;
  children: string[];
  color?: string;
}

interface GraphEdge {
  from: string;
  to: string;
}

const NODE_COLORS = {
  core:      { fill: 'hsl(var(--primary))', text: 'hsl(var(--primary-foreground))', stroke: 'hsl(var(--primary))', r: 38 },
  primary:   { fill: 'hsl(var(--chart-2))', text: '#fff', stroke: 'hsl(var(--chart-2))', r: 30 },
  secondary: { fill: 'hsl(var(--chart-3))', text: '#fff', stroke: 'hsl(var(--chart-3))', r: 24 },
  leaf:      { fill: 'hsl(var(--muted))', text: 'hsl(var(--foreground))', stroke: 'hsl(var(--border))', r: 18 },
};

// 预设知识图谱模板
const PRESET_GRAPHS: Record<string, { nodes: Omit<GraphNode, 'x' | 'y'>[]; title: string }> = {
  dataStructures: {
    title: '数据结构',
    nodes: [
      { id: 'ds', label: '数据结构', type: 'core', description: '计算机存储和组织数据的方式', children: ['linear', 'tree', 'graph', 'hash'] },
      { id: 'linear', label: '线性结构', type: 'primary', description: '数据元素之间存在一对一关系', children: ['array', 'list', 'stack', 'queue'] },
      { id: 'tree', label: '树结构', type: 'primary', description: '数据元素之间存在一对多关系', children: ['binary', 'bst', 'heap', 'trie'] },
      { id: 'graph', label: '图结构', type: 'primary', description: '数据元素之间存在多对多关系', children: ['directed', 'undirected'] },
      { id: 'hash', label: '哈希表', type: 'primary', description: '通过散列函数实现快速查找', children: ['collision'] },
      { id: 'array', label: '数组', type: 'secondary', description: '连续内存，O(1)随机访问', children: [] },
      { id: 'list', label: '链表', type: 'secondary', description: '动态内存，高效插入删除', children: [] },
      { id: 'stack', label: '栈', type: 'secondary', description: 'LIFO，括号匹配/DFS', children: [] },
      { id: 'queue', label: '队列', type: 'secondary', description: 'FIFO，BFS/任务调度', children: [] },
      { id: 'binary', label: '二叉树', type: 'secondary', description: '每节点最多两个子节点', children: [] },
      { id: 'bst', label: '二叉搜索树', type: 'secondary', description: '左<根<右，O(logn)查找', children: [] },
      { id: 'heap', label: '堆', type: 'secondary', description: '完全二叉树，优先队列', children: [] },
      { id: 'trie', label: '前缀树', type: 'secondary', description: '字符串检索，自动补全', children: [] },
      { id: 'directed', label: '有向图', type: 'leaf', description: '边有方向，拓扑排序', children: [] },
      { id: 'undirected', label: '无向图', type: 'leaf', description: '边无方向，连通分量', children: [] },
      { id: 'collision', label: '冲突处理', type: 'leaf', description: '链地址法/开放寻址', children: [] },
    ],
  },
  algorithms: {
    title: '算法基础',
    nodes: [
      { id: 'algo', label: '算法', type: 'core', description: '解决问题的步骤和方法', children: ['sort', 'search', 'dp', 'graph_algo'] },
      { id: 'sort', label: '排序算法', type: 'primary', description: '将数据按特定顺序排列', children: ['bubble', 'quick', 'merge', 'heap_sort'] },
      { id: 'search', label: '搜索算法', type: 'primary', description: '在数据集合中查找目标', children: ['bfs', 'dfs', 'binary_search'] },
      { id: 'dp', label: '动态规划', type: 'primary', description: '将问题分解为重叠子问题', children: ['memoize', 'tabulate'] },
      { id: 'graph_algo', label: '图算法', type: 'primary', description: '图上的经典算法', children: ['dijkstra', 'kruskal'] },
      { id: 'bubble', label: '冒泡排序', type: 'secondary', description: 'O(n²)，稳定，简单', children: [] },
      { id: 'quick', label: '快速排序', type: 'secondary', description: 'O(nlogn)，分治策略', children: [] },
      { id: 'merge', label: '归并排序', type: 'secondary', description: 'O(nlogn)，稳定，分治', children: [] },
      { id: 'heap_sort', label: '堆排序', type: 'secondary', description: 'O(nlogn)，原地排序', children: [] },
      { id: 'bfs', label: '广度优先', type: 'secondary', description: '层序遍历，最短路径', children: [] },
      { id: 'dfs', label: '深度优先', type: 'secondary', description: '回溯，路径搜索', children: [] },
      { id: 'binary_search', label: '二分查找', type: 'secondary', description: 'O(logn)，有序数组', children: [] },
      { id: 'memoize', label: '记忆化搜索', type: 'leaf', description: '自顶向下，缓存子问题', children: [] },
      { id: 'tabulate', label: '填表法', type: 'leaf', description: '自底向上，迭代求解', children: [] },
      { id: 'dijkstra', label: 'Dijkstra', type: 'leaf', description: '单源最短路径', children: [] },
      { id: 'kruskal', label: 'Kruskal', type: 'leaf', description: '最小生成树', children: [] },
    ],
  },
  ml: {
    title: '机器学习',
    nodes: [
      { id: 'ml', label: '机器学习', type: 'core', description: '让计算机从数据中学习', children: ['supervised', 'unsupervised', 'reinforcement', 'dl'] },
      { id: 'supervised', label: '监督学习', type: 'primary', description: '有标签数据训练模型', children: ['classification', 'regression'] },
      { id: 'unsupervised', label: '无监督学习', type: 'primary', description: '无标签数据发现规律', children: ['clustering', 'dim_reduction'] },
      { id: 'reinforcement', label: '强化学习', type: 'primary', description: '智能体与环境交互学习', children: ['q_learning'] },
      { id: 'dl', label: '深度学习', type: 'primary', description: '多层神经网络学习特征', children: ['cnn', 'rnn', 'transformer'] },
      { id: 'classification', label: '分类', type: 'secondary', description: 'SVM/决策树/随机森林', children: [] },
      { id: 'regression', label: '回归', type: 'secondary', description: '线性/多项式/岭回归', children: [] },
      { id: 'clustering', label: '聚类', type: 'secondary', description: 'K-means/DBSCAN', children: [] },
      { id: 'dim_reduction', label: '降维', type: 'secondary', description: 'PCA/t-SNE/AutoEncoder', children: [] },
      { id: 'q_learning', label: 'Q-Learning', type: 'secondary', description: '基于Q值的策略学习', children: [] },
      { id: 'cnn', label: 'CNN', type: 'secondary', description: '图像识别，卷积操作', children: [] },
      { id: 'rnn', label: 'RNN/LSTM', type: 'secondary', description: '序列建模，时序数据', children: [] },
      { id: 'transformer', label: 'Transformer', type: 'leaf', description: '注意力机制，GPT/BERT', children: [] },
    ],
  },
};

function layoutNodes(nodes: Omit<GraphNode, 'x' | 'y'>[]): GraphNode[] {
  const W = 900, H = 700;
  const cx = W / 2, cy = H / 2;
  const result: GraphNode[] = [];
  const core = nodes.find(n => n.type === 'core');
  if (!core) return [];

  // 构建层级
  const placed: Record<string, { x: number; y: number }> = {};
  placed[core.id] = { x: cx, y: cy };

  const primaries = nodes.filter(n => core.children.includes(n.id));
  const pCount = primaries.length;
  primaries.forEach((p, i) => {
    const angle = (i / pCount) * 2 * Math.PI - Math.PI / 2;
    placed[p.id] = {
      x: cx + Math.cos(angle) * 200,
      y: cy + Math.sin(angle) * 180,
    };
  });

  primaries.forEach((p, pi) => {
    const secs = nodes.filter(n => p.children.includes(n.id));
    secs.forEach((s, si) => {
      const base = placed[p.id];
      const pAngle = (pi / pCount) * 2 * Math.PI - Math.PI / 2;
      const spread = secs.length > 1 ? 0.6 : 0;
      const angle = pAngle + ((si - (secs.length - 1) / 2) * spread);
      placed[s.id] = {
        x: base.x + Math.cos(angle) * 130,
        y: base.y + Math.sin(angle) * 110,
      };
      // leaves
      const leaves = nodes.filter(n => s.children.includes(n.id));
      leaves.forEach((l, li) => {
        const la = angle + ((li - (leaves.length - 1) / 2) * 0.5);
        placed[l.id] = {
          x: placed[s.id].x + Math.cos(la) * 80,
          y: placed[s.id].y + Math.sin(la) * 70,
        };
      });
    });
  });

  nodes.forEach(n => {
    const pos = placed[n.id] || { x: Math.random() * W, y: Math.random() * H };
    result.push({ ...n, ...pos, color: NODE_COLORS[n.type].fill });
  });
  return result;
}

function buildEdges(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  nodes.forEach(n => { n.children.forEach(c => edges.push({ from: n.id, to: c })); });
  return edges;
}

export default function KnowledgeGraphPage() {
  const { user } = useAuth();
  const [graphKey, setGraphKey] = useState<keyof typeof PRESET_GRAPHS>('dataStructures');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    loadPreset(graphKey);
  }, [graphKey]);

  const loadPreset = (key: keyof typeof PRESET_GRAPHS) => {
    const preset = PRESET_GRAPHS[key];
    const laid = layoutNodes(preset.nodes);
    setNodes(laid);
    setEdges(buildEdges(laid));
    setSelected(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('.node-group')) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.4, Math.min(2.5, z - e.deltaY * 0.001)));
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const buildAIGraph = async () => {
    if (!aiTopic.trim()) { toast.error('请输入主题'); return; }
    setAiLoading(true);
    toast.info('AI 正在构建知识图谱...');
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `请为"${aiTopic}"构建一个知识图谱，输出JSON格式，结构如下：
{"nodes":[{"id":"唯一id","label":"节点名称","type":"core|primary|secondary|leaf","description":"简短描述","children":["子节点id"]}]}
要求：
1. 包含1个core节点（主题本身），3-5个primary节点（主要分支），每个primary有2-4个secondary节点
2. description不超过20字
3. 只输出JSON，不要其他文字`
          }],
          portrait: null,
        }
      });
      if (error) throw error;
      const text: string = data?.content || data?.message || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('解析失败');
      const parsed = JSON.parse(jsonMatch[0]);
      const laid = layoutNodes(parsed.nodes);
      setNodes(laid);
      setEdges(buildEdges(laid));
      setSelected(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      toast.success('知识图谱已生成！');
    } catch {
      toast.error('AI 生成失败，请重试');
    } finally {
      setAiLoading(false);
    }
  };

  const getNodeById = (id: string) => nodes.find(n => n.id === id);
  const isHighlighted = (n: GraphNode) => {
    if (!selected) return true;
    return n.id === selected.id || selected.children.includes(n.id) ||
      nodes.some(p => p.children.includes(n.id) && p.id === selected.id) ||
      nodes.some(p => p.children.includes(selected.id) && p.children.includes(n.id));
  };

  const connectedNodes = selected
    ? [selected, ...selected.children.map(getNodeById).filter(Boolean) as GraphNode[]]
    : [];

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 标题 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" />知识图谱
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">可视化知识结构，发现概念之间的关联与脉络</p>
          </div>
          {/* 主题切换 */}
          <div className="flex items-center gap-2 flex-wrap">
            {(Object.keys(PRESET_GRAPHS) as (keyof typeof PRESET_GRAPHS)[]).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setGraphKey(k)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  graphKey === k ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {PRESET_GRAPHS[k].title}
              </button>
            ))}
          </div>
        </div>

        {/* AI 构建行 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="输入任意主题，AI 自动构建知识图谱（如：React hooks、线性代数、热力学...）"
              value={aiTopic}
              onChange={e => setAiTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buildAIGraph()}
            />
          </div>
          <Button onClick={buildAIGraph} disabled={aiLoading} className="shrink-0 gap-1.5">
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiLoading ? 'AI 构建中...' : 'AI 生成图谱'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* 图谱主区域 */}
          <div className="lg:col-span-3">
            <Card className="relative overflow-hidden">
              {/* 缩放控制 */}
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setZoom(z => Math.min(z + 0.2, 2.5))}><ZoomIn className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}><ZoomOut className="w-3.5 h-3.5" /></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelected(null); }}><RotateCcw className="w-3.5 h-3.5" /></Button>
              </div>
              {/* 图例 */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 text-[10px]">
                {(Object.entries(NODE_COLORS) as [keyof typeof NODE_COLORS, typeof NODE_COLORS['core']][]).map(([type, cfg]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: cfg.fill }} />
                    <span className="text-muted-foreground capitalize">{{ core: '核心', primary: '主分支', secondary: '子节点', leaf: '叶节点' }[type]}</span>
                  </div>
                ))}
              </div>
              <svg
                ref={svgRef}
                className={`w-full rounded-xl bg-gradient-to-br from-muted/30 to-background ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                viewBox="0 0 900 700"
                style={{ height: '520px' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <defs>
                  <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="hsl(var(--border))" />
                  </marker>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                  {/* 边 */}
                  {edges.map(e => {
                    const from = getNodeById(e.from);
                    const to = getNodeById(e.to);
                    if (!from || !to) return null;
                    const mx = (from.x + to.x) / 2;
                    const my = (from.y + to.y) / 2 - 20;
                    const highlighted = !selected || isHighlighted(from) && isHighlighted(to);
                    return (
                      <path
                        key={`${e.from}-${e.to}`}
                        d={`M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`}
                        fill="none"
                        stroke={highlighted ? 'hsl(var(--border))' : 'hsl(var(--border)/0.2)'}
                        strokeWidth={highlighted ? 1.5 : 0.8}
                        strokeDasharray={highlighted ? 'none' : '4,4'}
                        markerEnd="url(#arrow)"
                        opacity={highlighted ? 1 : 0.3}
                        style={{ transition: 'opacity 0.2s' }}
                      />
                    );
                  })}
                  {/* 节点 */}
                  {nodes.map(n => {
                    const cfg = NODE_COLORS[n.type];
                    const hi = isHighlighted(n);
                    const isSelected = selected?.id === n.id;
                    return (
                      <g
                        key={n.id}
                        className="node-group"
                        transform={`translate(${n.x},${n.y})`}
                        style={{ cursor: 'pointer', opacity: hi ? 1 : 0.25, transition: 'opacity 0.2s' }}
                        onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : n); }}
                      >
                        {isSelected && (
                          <circle r={cfg.r + 10} fill="none" stroke={cfg.fill} strokeWidth={2.5} strokeDasharray="6,3" opacity={0.6} />
                        )}
                        <circle
                          r={cfg.r}
                          fill={cfg.fill}
                          stroke={isSelected ? 'hsl(var(--background))' : 'hsl(var(--background))'}
                          strokeWidth={2}
                          filter={isSelected ? 'url(#glow)' : 'none'}
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={cfg.text}
                          fontSize={n.type === 'core' ? 13 : n.type === 'primary' ? 11 : n.type === 'secondary' ? 10 : 9}
                          fontWeight={n.type === 'core' ? 700 : n.type === 'primary' ? 600 : 400}
                          style={{ userSelect: 'none', pointerEvents: 'none' }}
                        >
                          {n.label.length > 6 ? n.label.slice(0, 6) + '…' : n.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
              <p className="text-[11px] text-muted-foreground text-center py-2">点击节点查看详情 · 滚轮缩放 · 拖拽移动</p>
            </Card>
          </div>

          {/* 右侧信息面板 */}
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {selected ? (
                <motion.div key={selected.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: NODE_COLORS[selected.type].fill }}>
                            <Layers className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{selected.label}</CardTitle>
                            <Badge variant="secondary" className="text-[10px] mt-0.5">
                              {{ core: '核心概念', primary: '主要分支', secondary: '子知识点', leaf: '叶节点' }[selected.type]}
                            </Badge>
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelected(null)}>
                          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{selected.description}</p>
                      {selected.children.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-2 flex items-center gap-1"><Link className="w-3 h-3" />关联概念</p>
                          <div className="space-y-1.5">
                            {selected.children.map(cid => {
                              const c = getNodeById(cid);
                              if (!c) return null;
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  onClick={() => setSelected(c)}
                                  className="flex items-center gap-2 w-full p-2 rounded-lg bg-muted/50 hover:bg-muted text-left transition-colors text-xs"
                                >
                                  <ChevronRight className="w-3 h-3 text-primary shrink-0" />
                                  <span className="font-medium">{c.label}</span>
                                  <span className="text-muted-foreground text-[10px] truncate">{c.description}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      <Network className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium mb-1">点击节点查看详情</p>
                      <p className="text-xs">了解知识点的定义和关联关系</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 图谱统计 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />图谱概览
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {[
                  { label: '知识节点', value: nodes.length },
                  { label: '关联边', value: edges.length },
                  { label: '核心概念', value: nodes.filter(n => n.type === 'core').length },
                  { label: '子知识点', value: nodes.filter(n => n.type === 'secondary' || n.type === 'leaf').length },
                ].map(s => (
                  <div key={s.label} className="text-center p-2 rounded-lg bg-muted/40">
                    <p className="text-lg font-bold text-primary">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 快速导航 */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />所有节点
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {nodes.filter(n => n.type === 'core' || n.type === 'primary').map(n => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelected(n)}
                      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-left transition-colors text-xs ${
                        selected?.id === n.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: NODE_COLORS[n.type].fill }} />
                      {n.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
