import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Network, Sparkles, X, ZoomIn, ZoomOut, RotateCcw, BookOpen, Layers, Link, ChevronRight, Cpu, Loader2 } from 'lucide-react';

type NodeType = 'core' | 'primary' | 'secondary' | 'leaf';
interface GraphNode { id: string; label: string; type: NodeType; description: string; children: string[]; x: number; y: number; mastery?: number | null; confidence?: number | null; }
interface GraphEdge { from: string; to: string; }
interface CourseRow { id: string; code: string | null; name: string; }
interface ModuleRow { id: string; code: string; title: string; summary?: string | null; position: number; }
interface PointRow { id: string; module_id: string; code: string; title: string; description: string; position: number; }
interface PrerequisiteRow { knowledge_point_id: string; prerequisite_id: string; }
interface MasteryRow { knowledge_point_id: string; mastery_score: number; confidence: number; }

const LIMIT = 60;
const COLORS: Record<NodeType, { fill: string; text: string; r: number }> = {
  core: { fill: 'hsl(var(--primary))', text: 'hsl(var(--primary-foreground))', r: 38 },
  primary: { fill: 'hsl(var(--chart-2))', text: '#fff', r: 30 },
  secondary: { fill: 'hsl(var(--chart-3))', text: '#fff', r: 24 },
  leaf: { fill: 'hsl(var(--muted))', text: 'hsl(var(--foreground))', r: 18 },
};

const PRESETS: Record<string, { title: string; nodes: Omit<GraphNode, 'x' | 'y'>[] }> = {
  dataStructures: { title: '数据结构', nodes: [
    { id: 'ds', label: '数据结构', type: 'core', description: '计算机存储和组织数据的方式', children: ['linear', 'tree', 'graph', 'hash'] },
    { id: 'linear', label: '线性结构', type: 'primary', description: '数据元素一对一关系', children: ['array', 'list', 'stack', 'queue'] },
    { id: 'tree', label: '树结构', type: 'primary', description: '数据元素一对多关系', children: ['binary', 'bst', 'heap'] },
    { id: 'graph', label: '图结构', type: 'primary', description: '数据元素多对多关系', children: ['directed', 'undirected'] },
    { id: 'hash', label: '哈希表', type: 'primary', description: '散列函数快速查找', children: ['collision'] },
    ...['数组', '链表', '栈', '队列', '二叉树', '二叉搜索树', '堆', '有向图', '无向图', '冲突处理'].map((label, index) => ({ id: ['array', 'list', 'stack', 'queue', 'binary', 'bst', 'heap', 'directed', 'undirected', 'collision'][index], label, type: index > 6 ? 'leaf' as NodeType : 'secondary' as NodeType, description: '预设知识点', children: [] })),
  ] },
  algorithms: { title: '算法基础', nodes: [
    { id: 'algo', label: '算法', type: 'core', description: '解决问题的步骤和方法', children: ['sort', 'search', 'dp'] },
    { id: 'sort', label: '排序算法', type: 'primary', description: '按特定顺序排列数据', children: ['quick', 'merge'] },
    { id: 'search', label: '搜索算法', type: 'primary', description: '在数据集合中查找目标', children: ['bfs', 'dfs'] },
    { id: 'dp', label: '动态规划', type: 'primary', description: '分解重叠子问题', children: ['memoize'] },
    ...['快速排序', '归并排序', '广度优先', '深度优先', '记忆化搜索'].map((label, index) => ({ id: ['quick', 'merge', 'bfs', 'dfs', 'memoize'][index], label, type: 'secondary' as NodeType, description: '预设知识点', children: [] })),
  ] },
};

function layout(nodes: Omit<GraphNode, 'x' | 'y'>[]): GraphNode[] {
  const ordered = [...nodes].slice(0, LIMIT);
  const core = ordered.find(node => node.type === 'core');
  if (!core) return [];
  const positions = new Map<string, { x: number; y: number }>([[core.id, { x: 450, y: 350 }]]);
  const primaries = ordered.filter(node => core.children.includes(node.id));
  const primaryCount = Math.max(primaries.length, 1);
  primaries.forEach((node, index) => {
    const angle = index * 2 * Math.PI / primaryCount - Math.PI / 2;
    positions.set(node.id, { x: 450 + Math.cos(angle) * 210, y: 350 + Math.sin(angle) * 180 });
    const descendants = ordered.filter(candidate => node.children.includes(candidate.id));
    descendants.forEach((child, childIndex) => {
      const childAngle = angle + (childIndex - (descendants.length - 1) / 2) * 0.42;
      positions.set(child.id, { x: 450 + Math.cos(angle) * 210 + Math.cos(childAngle) * 125, y: 350 + Math.sin(angle) * 180 + Math.sin(childAngle) * 105 });
    });
  });
  const unplaced = ordered.filter(node => !positions.has(node.id));
  unplaced.forEach((node, index) => {
    const angle = index * 2 * Math.PI / Math.max(unplaced.length, 1) - Math.PI / 2;
    positions.set(node.id, { x: 450 + Math.cos(angle) * 300, y: 350 + Math.sin(angle) * 260 });
  });
  return ordered.map(node => ({ ...node, ...positions.get(node.id)! }));
}

function edgesFrom(nodes: GraphNode[]): GraphEdge[] {
  const ids = new Set(nodes.map(node => node.id));
  return nodes.flatMap(node => node.children.filter(child => ids.has(child)).map(to => ({ from: node.id, to })));
}

function validateAiGraph(value: unknown): Omit<GraphNode, 'x' | 'y'>[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { nodes?: unknown }).nodes)) throw new Error('AI 图谱缺少 nodes 数组');
  const nodes = (value as { nodes: unknown[] }).nodes;
  if (nodes.length < 2 || nodes.length > LIMIT) throw new Error(`AI 图谱节点数必须在 2 到 ${LIMIT} 之间`);
  const validTypes = new Set<NodeType>(['core', 'primary', 'secondary', 'leaf']);
  const ids = new Set<string>();
  const normalized = nodes.map(item => {
    if (!item || typeof item !== 'object') throw new Error('AI 图谱包含无效节点');
    const node = item as Record<string, unknown>;
    if (typeof node.id !== 'string' || !node.id.trim() || ids.has(node.id) || typeof node.label !== 'string' || !node.label.trim() || typeof node.description !== 'string' || !validTypes.has(node.type as NodeType) || !Array.isArray(node.children) || !node.children.every(child => typeof child === 'string')) throw new Error('AI 图谱节点字段无效');
    ids.add(node.id);
    return { id: node.id.trim(), label: node.label.trim(), type: node.type as NodeType, description: node.description.trim().slice(0, 120), children: node.children as string[] };
  });
  if (normalized.filter(node => node.type === 'core').length !== 1) throw new Error('AI 图谱必须包含且只包含一个核心节点');
  if (normalized.some(node => node.children.some(child => !ids.has(child) || child === node.id))) throw new Error('AI 图谱包含不存在或自引用的关联');
  return normalized;
}

export default function KnowledgeGraphPage() {
  const { user } = useAuth();
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [presetKey, setPresetKey] = useState<keyof typeof PRESETS>('dataStructures');
  const [mode, setMode] = useState<'course' | 'preset' | 'ai'>('preset');
  const [courseName, setCourseName] = useState('');
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const setGraph = (raw: Omit<GraphNode, 'x' | 'y'>[], nextMode: 'course' | 'preset' | 'ai', title = '') => {
    const graph = layout(raw);
    setNodes(graph); setEdges(edgesFrom(graph)); setSelected(null); setZoom(1); setPan({ x: 0, y: 0 }); setMode(nextMode); setCourseName(title);
  };
  const loadPreset = (key: keyof typeof PRESETS) => { setPresetKey(key); setGraph(PRESETS[key].nodes, 'preset', PRESETS[key].title); };

  useEffect(() => {
    let active = true;
    const loadCourse = async () => {
      setLoadingCourse(true);
      try {
        const { data: courses, error: courseError } = await supabase.from('courses').select('id, code, name').or('name.ilike.%人工智能基础%,code.ilike.%AI%').limit(20);
        if (courseError) throw courseError;
        const course = (courses as CourseRow[] | null)?.find(item => item.name.includes('人工智能基础'));
        if (!course) { if (active) { loadPreset('dataStructures'); toast.info('未找到《人工智能基础》课程数据，正在显示预设图谱。'); } return; }
        const [modulesResult, pointsResult, prerequisiteResult, masteryResult] = await Promise.all([
          supabase.from('course_modules').select('id, code, title, summary, position').eq('course_id', course.id).order('position'),
          supabase.from('knowledge_points').select('id, module_id, code, title, description, position').eq('course_id', course.id).order('position'),
          supabase.from('knowledge_point_prerequisites').select('knowledge_point_id, prerequisite_id').eq('course_id', course.id),
          user ? supabase.from('user_knowledge_mastery').select('knowledge_point_id, mastery_score, confidence').eq('user_id', user.id).eq('course_id', course.id) : Promise.resolve({ data: [], error: null }),
        ]);
        if (modulesResult.error || pointsResult.error || prerequisiteResult.error || masteryResult.error) throw modulesResult.error ?? pointsResult.error ?? prerequisiteResult.error ?? masteryResult.error;
        const modules = (modulesResult.data ?? []) as ModuleRow[];
        const points = (pointsResult.data ?? []) as PointRow[];
        if (!modules.length || !points.length) { if (active) { loadPreset('dataStructures'); toast.info('《人工智能基础》课程结构不完整，正在显示预设图谱。'); } return; }
        const keptPoints = points.slice(0, LIMIT - modules.length - 1);
        const allowed = new Set(keptPoints.map(point => point.id));
        const mastery = new Map(((masteryResult.data ?? []) as MasteryRow[]).map(row => [row.knowledge_point_id, row]));
        const prerequisite = (prerequisiteResult.data ?? []) as PrerequisiteRow[];
        const pointChildren = new Map<string, string[]>();
        prerequisite.forEach(row => { if (allowed.has(row.knowledge_point_id) && allowed.has(row.prerequisite_id)) pointChildren.set(row.prerequisite_id, [...(pointChildren.get(row.prerequisite_id) ?? []), row.knowledge_point_id]); });
        const raw: Omit<GraphNode, 'x' | 'y'>[] = [{ id: course.id, label: course.name, type: 'core', description: course.code ? `课程代码：${course.code}` : '真实课程知识图谱', children: modules.map(module => module.id) }];
        raw.push(...modules.map(module => ({ id: module.id, label: module.title, type: 'primary' as NodeType, description: module.summary || module.code, children: keptPoints.filter(point => point.module_id === module.id).filter(point => !prerequisite.some(row => row.knowledge_point_id === point.id && allowed.has(row.prerequisite_id))).map(point => point.id) })));
        raw.push(...keptPoints.map(point => { const status = mastery.get(point.id); return { id: point.id, label: point.title, type: 'secondary' as NodeType, description: `${point.code}${point.description ? ` · ${point.description}` : ''}`, children: pointChildren.get(point.id) ?? [], mastery: status?.mastery_score ?? null, confidence: status?.confidence ?? null }; }));
        if (active) setGraph(raw, 'course', course.name);
      } catch (error) {
        if (active) { loadPreset('dataStructures'); toast.error(error instanceof Error ? `课程图谱加载失败：${error.message}` : '课程图谱加载失败，已降级为预设图谱。'); }
      } finally { if (active) setLoadingCourse(false); }
    };
    void loadCourse();
    return () => { active = false; };
  }, [user]);

  const wheel = useCallback((event: WheelEvent) => { event.preventDefault(); setZoom(value => Math.max(0.4, Math.min(2.5, value - event.deltaY * 0.001))); }, []);
  useEffect(() => { const element = svgRef.current; if (!element) return; element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel); }, [wheel]);

  const buildAiGraph = async () => {
    if (!aiTopic.trim()) { toast.error('请输入主题'); return; }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { portrait: null, messages: [{ role: 'user', content: `请为“${aiTopic.trim()}”构建知识图谱。只输出 JSON：{"nodes":[{"id":"唯一id","label":"节点名称","type":"core|primary|secondary|leaf","description":"简短描述","children":["子节点id"]}]}。必须恰好一个 core，最多 ${LIMIT} 节点。` }] } });
      if (error) throw error;
      const text = (data?.content || data?.message || '') as string;
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 未返回 JSON');
      setGraph(validateAiGraph(JSON.parse(match[0])), 'ai', aiTopic.trim());
      toast.success('AI 知识图谱已生成');
    } catch (error) { toast.error(error instanceof Error ? `AI 图谱无效：${error.message}` : 'AI 图谱生成失败'); }
    finally { setAiLoading(false); }
  };

  const byId = (id: string) => nodes.find(node => node.id === id);
  const highlighted = (node: GraphNode) => !selected || node.id === selected.id || selected.children.includes(node.id) || node.children.includes(selected.id);
  const selectedMastery = selected?.mastery == null ? null : `${Math.round(selected.mastery * 100)}%`;

  return <AppLayout><div className="space-y-4">
    <div className="flex flex-col md:flex-row md:justify-between gap-3"><div><h1 className="text-xl font-bold flex gap-2"><Network className="w-5 h-5 text-primary" />知识图谱</h1><p className="text-sm text-muted-foreground">{mode === 'course' ? `正在显示真实《${courseName}》课程图谱` : mode === 'preset' ? '课程数据不可用时的预设降级图谱' : 'AI 生成图谱'}</p></div><div className="flex gap-2 flex-wrap">{(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map(key => <button key={key} type="button" onClick={() => loadPreset(key)} className={`text-xs px-3 py-1.5 rounded-full border ${mode === 'preset' && presetKey === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{PRESETS[key].title}</button>)}</div></div>
    <div className="flex gap-2"><div className="relative flex-1"><Sparkles className="absolute w-3.5 h-3.5 left-3 top-1/2 -translate-y-1/2" /><Input className="pl-9" value={aiTopic} onChange={event => setAiTopic(event.target.value)} onKeyDown={event => event.key === 'Enter' && void buildAiGraph()} placeholder="输入主题，AI 自动构建知识图谱" /></div><Button onClick={() => void buildAiGraph()} disabled={aiLoading}>{aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{aiLoading ? '构建中' : 'AI 生成图谱'}</Button></div>
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4"><div className="lg:col-span-3"><Card className="relative overflow-hidden"><div className="absolute top-3 right-3 z-10 flex flex-col gap-1"><Button variant="outline" size="icon" onClick={() => setZoom(value => Math.min(2.5, value + .2))}><ZoomIn className="w-3.5 h-3.5" /></Button><Button variant="outline" size="icon" onClick={() => setZoom(value => Math.max(.4, value - .2))}><ZoomOut className="w-3.5 h-3.5" /></Button><Button variant="outline" size="icon" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelected(null); }}><RotateCcw className="w-3.5 h-3.5" /></Button></div>
      <svg ref={svgRef} viewBox="0 0 900 700" style={{ height: 520 }} className={`w-full bg-gradient-to-br from-muted/30 to-background ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`} onMouseDown={event => { if ((event.target as Element).closest('.node')) return; setDragging(true); setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y }); }} onMouseMove={event => dragging && setPan({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y })} onMouseUp={() => setDragging(false)} onMouseLeave={() => setDragging(false)}><g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        {edges.map(edge => { const from = byId(edge.from); const to = byId(edge.to); if (!from || !to) return null; return <path key={`${edge.from}-${edge.to}`} d={`M${from.x},${from.y} Q${(from.x + to.x) / 2},${(from.y + to.y) / 2 - 20} ${to.x},${to.y}`} fill="none" stroke="hsl(var(--border))" strokeWidth={highlighted(from) && highlighted(to) ? 1.5 : .8} opacity={highlighted(from) && highlighted(to) ? 1 : .2} />; })}
        {nodes.map(node => { const color = COLORS[node.type]; const active = selected?.id === node.id; return <g key={node.id} className="node" transform={`translate(${node.x},${node.y})`} style={{ cursor: 'pointer', opacity: highlighted(node) ? 1 : .25 }} onClick={event => { event.stopPropagation(); setSelected(active ? null : node); }}><circle r={color.r + (active ? 7 : 0)} fill={color.fill} stroke="hsl(var(--background))" strokeWidth="2" /><text textAnchor="middle" dominantBaseline="middle" fill={color.text} fontSize={node.type === 'core' ? 13 : 10} fontWeight={node.type === 'core' ? 700 : 500}>{node.label.length > 8 ? `${node.label.slice(0, 8)}…` : node.label}</text>{node.mastery != null && <text textAnchor="middle" y={color.r + 13} fill="hsl(var(--foreground))" fontSize="9">掌握 {Math.round(node.mastery * 100)}%</text>}</g>; })}
      </g></svg><p className="text-[11px] text-muted-foreground text-center py-2">{loadingCourse ? '正在加载真实课程图谱…' : '点击节点查看详情 · 滚轮缩放 · 拖拽移动'}</p></Card></div>
      <div className="space-y-3"><AnimatePresence mode="wait">{selected ? <motion.div key={selected.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Card><CardHeader className="pb-2"><div className="flex justify-between"><div><CardTitle className="text-sm flex gap-2"><Layers className="w-4 h-4" />{selected.label}</CardTitle><Badge className="mt-1" variant="secondary">{{ core: '课程', primary: '模块', secondary: '知识点', leaf: '叶节点' }[selected.type]}</Badge></div><button type="button" onClick={() => setSelected(null)}><X className="w-4 h-4" /></button></div></CardHeader><CardContent className="space-y-2"><p className="text-sm text-muted-foreground">{selected.description}</p>{selectedMastery && <div className="text-xs space-y-1"><p>掌握度：{selectedMastery}</p><p>置信度：{Math.round((selected.confidence ?? 0) * 100)}%</p></div>}{selected.children.length > 0 && <div>{selected.children.map(id => { const child = byId(id); return child && <button key={id} type="button" onClick={() => setSelected(child)} className="w-full text-left text-xs p-2 rounded hover:bg-muted flex gap-1"><ChevronRight className="w-3 h-3" />{child.label}</button>; })}</div>}</CardContent></Card></motion.div> : <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Card><CardContent className="p-6 text-center text-muted-foreground"><Network className="w-10 h-10 mx-auto mb-3 opacity-20" /><p className="text-sm">点击节点查看详情</p></CardContent></Card></motion.div>}</AnimatePresence>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex gap-1"><Cpu className="w-3.5 h-3.5" />图谱概览</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2 text-center">{[{ label: '知识节点', value: nodes.length }, { label: '关联边', value: edges.length }, { label: '已评估', value: nodes.filter(node => node.mastery != null).length }, { label: '课程模式', value: mode === 'course' ? '真实' : '降级' }].map(item => <div key={item.label} className="p-2 bg-muted/40 rounded"><p className="font-bold text-primary">{item.value}</p><p className="text-[10px] text-muted-foreground">{item.label}</p></div>)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs flex gap-1"><BookOpen className="w-3.5 h-3.5" />所有节点</CardTitle></CardHeader><CardContent className="max-h-48 overflow-auto">{nodes.filter(node => node.type === 'core' || node.type === 'primary').map(node => <button key={node.id} type="button" onClick={() => setSelected(node)} className="block w-full text-left text-xs p-2 hover:bg-muted rounded">{node.label}</button>)}</CardContent></Card>
      </div></div>
  </div></AppLayout>;
}
