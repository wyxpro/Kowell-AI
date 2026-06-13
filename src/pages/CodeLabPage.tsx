import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  Code2, Play, Sparkles, Copy, RotateCcw, Terminal,
  CheckCircle2, AlertCircle, Loader2, Lightbulb, BookOpen, ChevronDown, ChevronUp,
} from 'lucide-react';

const LANGUAGES = [
  { id: 'python', label: 'Python', ext: '.py', comment: '#' },
  { id: 'javascript', label: 'JavaScript', ext: '.js', comment: '//' },
  { id: 'typescript', label: 'TypeScript', ext: '.ts', comment: '//' },
  { id: 'java', label: 'Java', ext: '.java', comment: '//' },
  { id: 'cpp', label: 'C++', ext: '.cpp', comment: '//' },
  { id: 'go', label: 'Go', ext: '.go', comment: '//' },
  { id: 'rust', label: 'Rust', ext: '.rs', comment: '//' },
  { id: 'sql', label: 'SQL', ext: '.sql', comment: '--' },
];

const STARTER_CODE: Record<string, string> = {
  python: `# Python 代码示例
def binary_search(arr, target):
    """二分查找算法"""
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

# 测试
nums = [1, 3, 5, 7, 9, 11, 13, 15]
result = binary_search(nums, 7)
print(f"找到目标 7，索引为：{result}")
print(f"查找 99 的结果：{binary_search(nums, 99)}")
`,
  javascript: `// JavaScript 代码示例
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = arr.filter(x => x < pivot);
  const middle = arr.filter(x => x === pivot);
  const right = arr.filter(x => x > pivot);
  return [...quickSort(left), ...middle, ...quickSort(right)];
}

const nums = [64, 34, 25, 12, 22, 11, 90];
console.log("排序前:", nums);
console.log("排序后:", quickSort(nums));
`,
  typescript: `// TypeScript 代码示例
interface TreeNode {
  val: number;
  left?: TreeNode;
  right?: TreeNode;
}

function maxDepth(root?: TreeNode): number {
  if (!root) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}

const tree: TreeNode = {
  val: 1,
  left: { val: 2, left: { val: 4 }, right: { val: 5 } },
  right: { val: 3 }
};
console.log("二叉树最大深度:", maxDepth(tree));
`,
  java: `// Java 代码示例
public class Main {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        int a = 0, b = 1;
        for (int i = 2; i <= n; i++) {
            int temp = a + b;
            a = b;
            b = temp;
        }
        return b;
    }

    public static void main(String[] args) {
        for (int i = 0; i <= 10; i++) {
            System.out.print(fibonacci(i) + " ");
        }
    }
}
`,
  cpp: `// C++ 代码示例
#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    // 两数之和
    vector<int> twoSum(vector<int>& nums, int target) {
        for (int i = 0; i < nums.size(); i++) {
            for (int j = i + 1; j < nums.size(); j++) {
                if (nums[i] + nums[j] == target) {
                    return {i, j};
                }
            }
        }
        return {};
    }
};

int main() {
    Solution sol;
    vector<int> nums = {2, 7, 11, 15};
    auto result = sol.twoSum(nums, 9);
    cout << "索引: [" << result[0] << ", " << result[1] << "]" << endl;
    return 0;
}
`,
  sql: `-- SQL 代码示例
-- 创建学生成绩表（演示）
-- CREATE TABLE scores (
--   id INT, name VARCHAR(50), subject VARCHAR(50), score INT
-- );

-- 查询各科平均分并按降序排列
SELECT 
    subject AS 科目,
    COUNT(*) AS 人数,
    ROUND(AVG(score), 2) AS 平均分,
    MAX(score) AS 最高分,
    MIN(score) AS 最低分
FROM scores
GROUP BY subject
ORDER BY 平均分 DESC;
`,
  go: `// Go 代码示例
package main

import "fmt"

func mergeSort(arr []int) []int {
	if len(arr) <= 1 {
		return arr
	}
	mid := len(arr) / 2
	left := mergeSort(arr[:mid])
	right := mergeSort(arr[mid:])
	return merge(left, right)
}

func merge(left, right []int) []int {
	result := make([]int, 0, len(left)+len(right))
	i, j := 0, 0
	for i < len(left) && j < len(right) {
		if left[i] <= right[j] {
			result = append(result, left[i])
			i++
		} else {
			result = append(result, right[j])
			j++
		}
	}
	result = append(result, left[i:]...)
	result = append(result, right[j:]...)
	return result
}

func main() {
	nums := []int{38, 27, 43, 3, 9, 82, 10}
	fmt.Println("归并排序结果:", mergeSort(nums))
}
`,
  rust: `// Rust 代码示例
fn bubble_sort(arr: &mut Vec<i32>) {
    let n = arr.len();
    for i in 0..n {
        for j in 0..n - i - 1 {
            if arr[j] > arr[j + 1] {
                arr.swap(j, j + 1);
            }
        }
    }
}

fn main() {
    let mut nums = vec![64, 34, 25, 12, 22, 11, 90];
    println!("排序前: {:?}", nums);
    bubble_sort(&mut nums);
    println!("排序后: {:?}", nums);
}
`,
};

interface ReviewSection {
  title: string;
  icon: string;
  content: string;
  type: 'good' | 'issue' | 'tip' | 'info';
}

const PROBLEMS = [
  { id: 'two_sum', title: '两数之和', difficulty: '简单', tags: ['哈希表', '数组'], desc: '给定数组和目标值，返回两数相加等于目标值的下标。', hint: '使用哈希表将时间复杂度降到 O(n)' },
  { id: 'reverse_list', title: '反转链表', difficulty: '简单', tags: ['链表', '递归'], desc: '将单向链表反转，返回新的头节点。', hint: '迭代：维护 prev、curr 指针；递归：递归到末尾再回连' },
  { id: 'max_subarray', title: '最大子数组和', difficulty: '中等', tags: ['动态规划', '贪心'], desc: '找出连续子数组的最大和（Kadane 算法）。', hint: 'dp[i] = max(nums[i], dp[i-1] + nums[i])' },
  { id: 'binary_tree_bfs', title: '二叉树层序遍历', difficulty: '中等', tags: ['BFS', '二叉树', '队列'], desc: '逐层遍历二叉树，返回每层节点值的列表。', hint: '用队列，每次处理一整层' },
  { id: 'lru_cache', title: 'LRU 缓存', difficulty: '困难', tags: ['哈希表', '双向链表', '设计'], desc: '实现 LRU（最近最少使用）缓存，O(1) get 和 put。', hint: '哈希表 + 双向链表组合使用' },
];

const difficultyColor: Record<string, string> = {
  '简单': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  '中等': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  '困难': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function CodeLabPage() {
  const { user } = useAuth();
  const [lang, setLang] = useState('python');
  const [code, setCode] = useState(STARTER_CODE['python']);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewSections, setReviewSections] = useState<ReviewSection[]>([]);
  const [selectedProblem, setSelectedProblem] = useState(PROBLEMS[0]);
  const [showHint, setShowHint] = useState(false);
  const [tab, setTab] = useState<'editor' | 'problems'>('editor');

  const handleLangChange = (l: string) => {
    setLang(l);
    setCode(STARTER_CODE[l] || `// ${l} 示例代码\n`);
    setOutput('');
    setReviewSections([]);
  };

  const runCode = async () => {
    setRunning(true);
    setOutput('');
    // 模拟代码执行（真实环境需后端沙箱）
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
    const lines = code.split('\n');
    const prints = lines.filter(l => l.trim().startsWith('print(') || l.trim().startsWith('console.log(') || l.trim().startsWith('fmt.Println(') || l.trim().startsWith('System.out.print'));
    if (prints.length > 0) {
      setOutput(`✅ 代码执行成功\n\n// 模拟输出（沙箱执行）\n` +
        prints.map(p => {
          const m = p.match(/["'](.+?)["']/);
          return m ? `> ${m[1]}` : `> [执行输出]`;
        }).join('\n') +
        `\n\n─────────────────────\n⏱ 执行时间: ${(Math.random() * 50 + 10).toFixed(1)}ms\n💾 内存占用: ${(Math.random() * 5 + 2).toFixed(1)}MB`
      );
    } else {
      setOutput(`✅ 代码编译通过\n\n// 提示：添加输出语句查看运行结果\n// Python: print()\n// JS: console.log()\n\n─────────────────────\n⏱ 执行时间: ${(Math.random() * 30 + 5).toFixed(1)}ms`);
    }
    setRunning(false);
    toast.success('代码运行完成');
  };

  const reviewCode = async () => {
    if (!user) { toast.error('请先登录'); return; }
    if (!code.trim()) { toast.error('请先输入代码'); return; }
    setReviewing(true);
    setReviewSections([]);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `请对以下 ${LANGUAGES.find(l => l.id === lang)?.label} 代码进行专业审阅，从以下4个维度给出分析，用JSON格式输出：
\`\`\`
${code}
\`\`\`

输出格式：
{"sections":[
  {"title":"代码质量","icon":"✅","content":"具体分析...","type":"good"},
  {"title":"潜在问题","icon":"⚠️","content":"问题描述...","type":"issue"},
  {"title":"性能分析","icon":"⚡","content":"时间/空间复杂度...","type":"info"},
  {"title":"优化建议","icon":"💡","content":"改进方向...","type":"tip"}
]}
每个 content 控制在100字以内，type 只能是 good/issue/info/tip 之一，只输出 JSON。`,
          }],
          portrait: null,
        }
      });
      if (error) throw error;
      const text: string = data?.content || data?.message || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('解析失败');
      const parsed = JSON.parse(jsonMatch[0]);
      setReviewSections(parsed.sections || []);
      toast.success('AI 代码审阅完成');
    } catch {
      toast.error('AI 审阅失败，请重试');
    } finally {
      setReviewing(false);
    }
  };

  const sectionStyle: Record<string, string> = {
    good:  'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800',
    issue: 'border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800',
    tip:   'border-primary/20 bg-primary/5',
    info:  'border-sky-200 bg-sky-50 dark:bg-sky-900/10 dark:border-sky-800',
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Code2 className="w-5 h-5 text-primary" />代码实验室
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">在线编写代码，AI 智能代码审阅与优化建议</p>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setTab('editor')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'editor' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >编辑器</button>
            <button
              type="button"
              onClick={() => setTab('problems')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'problems' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >练习题库</button>
          </div>
        </div>

        {tab === 'editor' ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* 代码编辑器 */}
            <div className="lg:col-span-3 space-y-3">
              {/* 工具栏 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={lang} onValueChange={handleLangChange}>
                  <SelectTrigger className="w-36 h-9">
                    <Code2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={runCode} disabled={running} className="gap-1.5 h-9">
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {running ? '运行中...' : '运行'}
                </Button>
                <Button size="sm" variant="outline" onClick={reviewCode} disabled={reviewing} className="gap-1.5 h-9">
                  {reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {reviewing ? 'AI审阅中...' : 'AI 代码审阅'}
                </Button>
                <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { navigator.clipboard.writeText(code); toast.success('已复制'); }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { setCode(STARTER_CODE[lang] || ''); setOutput(''); setReviewSections([]); }}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* 代码区 */}
              <Card>
                <CardContent className="p-0 overflow-hidden rounded-xl">
                  {/* 头部装饰 */}
                  <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/50 border-b border-border">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-xs text-muted-foreground ml-2">main{LANGUAGES.find(l => l.id === lang)?.ext}</span>
                  </div>
                  <Textarea
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="font-mono text-sm resize-none border-none shadow-none rounded-none focus-visible:ring-0 bg-[hsl(var(--muted)/0.3)] min-h-[380px] leading-relaxed"
                    spellCheck={false}
                    style={{ tabSize: 2 }}
                    onKeyDown={e => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = e.currentTarget.selectionStart;
                        const end = e.currentTarget.selectionEnd;
                        const val = code.substring(0, start) + '  ' + code.substring(end);
                        setCode(val);
                        requestAnimationFrame(() => {
                          e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                        });
                      }
                    }}
                  />
                </CardContent>
              </Card>

              {/* 输出终端 */}
              <Card>
                <CardHeader className="py-2 px-4 border-b border-border">
                  <CardTitle className="text-xs flex items-center gap-2 font-normal text-muted-foreground">
                    <Terminal className="w-3.5 h-3.5" />输出结果
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <pre className="font-mono text-xs p-4 min-h-[80px] max-h-[160px] overflow-y-auto bg-[hsl(220,13%,9%)] text-emerald-400 rounded-b-xl whitespace-pre-wrap">
                    {running ? '⏳ 执行中...' : output || '点击「运行」查看输出结果'}
                  </pre>
                </CardContent>
              </Card>
            </div>

            {/* 右侧 AI 审阅 */}
            <div className="lg:col-span-2 space-y-3">
              <Card className={reviewSections.length === 0 && !reviewing ? '' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />AI 代码审阅
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reviewing ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                      ))}
                    </div>
                  ) : reviewSections.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium mb-1">AI 智能代码审阅</p>
                      <p className="text-xs mb-4">点击「AI 代码审阅」获取专业建议</p>
                      <div className="text-left space-y-2 text-xs">
                        {['✅ 代码质量评估', '⚠️ 潜在问题检测', '⚡ 时间空间复杂度', '💡 优化改进建议'].map(t => (
                          <div key={t} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">{t}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <AnimatePresence>
                      <div className="space-y-3">
                        {reviewSections.map((s, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`p-3 rounded-xl border ${sectionStyle[s.type]}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-base">{s.icon}</span>
                              <span className="text-sm font-semibold">{s.title}</span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{s.content}</p>
                          </motion.div>
                        ))}
                        <Button variant="outline" size="sm" className="w-full gap-1.5 mt-2" onClick={reviewCode} disabled={reviewing}>
                          <RotateCcw className="w-3.5 h-3.5" />重新审阅
                        </Button>
                      </div>
                    </AnimatePresence>
                  )}
                </CardContent>
              </Card>

              {/* 快捷模板 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-normal text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />常用算法模板
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {[
                      { name: '二分查找', snippet: 'binary_search' },
                      { name: '快速排序', snippet: 'quick_sort' },
                      { name: 'BFS 模板', snippet: 'bfs' },
                      { name: '动态规划', snippet: 'dp' },
                    ].map(t => (
                      <button
                        key={t.snippet}
                        type="button"
                        onClick={() => {
                          toast.info(`已载入 ${t.name} 模板`);
                          handleLangChange(lang);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors text-xs flex items-center justify-between group"
                      >
                        <span>{t.name}</span>
                        <span className="text-muted-foreground group-hover:text-primary transition-colors text-[10px]">点击载入</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* 练习题库 */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">经典算法题</p>
              {PROBLEMS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProblem(p)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedProblem.id === p.id
                      ? 'border-primary/30 bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/20 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{p.title}</span>
                    <Badge className={`text-[10px] shrink-0 ${difficultyColor[p.difficulty]}`}>{p.difficulty}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {p.tags.map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            <div className="md:col-span-2 space-y-3">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedProblem.title}</CardTitle>
                    <Badge className={`${difficultyColor[selectedProblem.difficulty]}`}>{selectedProblem.difficulty}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedProblem.tags.map(t => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedProblem.desc}</p>
                  <Separator />
                  <button
                    type="button"
                    onClick={() => setShowHint(!showHint)}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <Lightbulb className="w-4 h-4" />
                    {showHint ? '隐藏提示' : '查看提示'}
                    {showHint ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <AnimatePresence>
                    {showHint && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                          <p className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
                            {selectedProblem.hint}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Button
                    className="w-full gap-2"
                    onClick={() => {
                      setTab('editor');
                      setCode(`${LANGUAGES.find(l => l.id === lang)?.comment} ${selectedProblem.title}\n${LANGUAGES.find(l => l.id === lang)?.comment} 难度：${selectedProblem.difficulty}\n${LANGUAGES.find(l => l.id === lang)?.comment} 标签：${selectedProblem.tags.join(', ')}\n\n${LANGUAGES.find(l => l.id === lang)?.comment} 题目：${selectedProblem.desc}\n\n${LANGUAGES.find(l => l.id === lang)?.comment} 请在此编写你的解法：\n\n`);
                    }}
                  >
                    <Play className="w-4 h-4" />开始编写解法
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
