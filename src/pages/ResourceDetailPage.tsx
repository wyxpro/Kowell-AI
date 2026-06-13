import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, BookOpen, Brain, Target, Code, FileText, Clock, CheckCircle, Edit, Tag } from 'lucide-react';
import type { Resource } from '@/types/types';
import { RESOURCE_TYPE_LABELS } from '@/types/types';

const resourceIcons: Record<string, React.ReactNode> = {
  document: <FileText className="w-5 h-5" />,
  mindmap: <Brain className="w-5 h-5" />,
  exercise: <Target className="w-5 h-5" />,
  reading: <BookOpen className="w-5 h-5" />,
  code: <Code className="w-5 h-5" />,
};

// 简单代码高亮（CSS变量着色）
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const highlighted = code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(\/\/.*$)/gm, '<span class="code-comment">$1</span>')
    .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="code-string">$1</span>')
    .replace(/\b(const|let|var|function|return|if|else|for|while|import|export|default|class|new|async|await|from|of|in)\b/g, '<span class="code-keyword">$1</span>')
    .replace(/\b(\d+)\b/g, '<span class="code-number">$1</span>');
  return (
    <div className="relative">
      {language && <span className="absolute top-2 right-3 text-xs text-muted-foreground">{language}</span>}
      <pre
        className="overflow-x-auto p-4 rounded-lg bg-[hsl(var(--muted))] text-sm font-mono leading-relaxed [&_.code-keyword]:text-primary [&_.code-string]:text-green-500 [&_.code-comment]:text-muted-foreground [&_.code-number]:text-amber-500"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [readProgress, setReadProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const el = document.getElementById('resource-content');
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
    const docH = scrollHeight - clientHeight;
    if (docH <= 0) { setReadProgress(100); return; }
    setReadProgress(Math.min(100, Math.round((scrollTop / docH) * 100)));
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!id) return;
    const fetchResource = async () => {
      const { data } = await supabase.from('resources').select('*').eq('id', id).maybeSingle();
      if (data) {
        setResource(data);
        if (!data.is_read) {
          await supabase.from('resources').update({ is_read: true, view_count: (data.view_count ?? 0) + 1 }).eq('id', id);
          setResource({ ...data, is_read: true });
        }
      }
      setLoading(false);
    };
    fetchResource();
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48 bg-muted" />
          <Skeleton className="h-96 bg-muted rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!resource) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">资源不存在</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/resources"><ArrowLeft className="w-4 h-4 mr-2" />返回资源中心</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const content = resource.content as Record<string, unknown>;

  return (
    <AppLayout>
      {/* 阅读进度条 - 固定在顶部 */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Progress value={readProgress} className="h-1 rounded-none" />
      </div>

      <div id="resource-content" className="space-y-6 pt-1">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/resources"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{resource.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">{RESOURCE_TYPE_LABELS[resource.resource_type]}</Badge>
              {resource.is_read && <Badge variant="outline" className="text-xs"><CheckCircle className="w-3 h-3 mr-1" />已读</Badge>}
              {resource.chapter && <span className="text-xs text-muted-foreground">{resource.chapter}</span>}
              {(resource.tags ?? []).map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">
                  <Tag className="w-2.5 h-2.5" />{tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground hidden md:inline">{readProgress}%</span>
            <Button asChild variant="outline" size="sm">
              <Link to={`/resources/${resource.id}/edit`}><Edit className="w-4 h-4 mr-1" />编辑</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {resourceIcons[resource.resource_type]}
              资源内容
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resource.resource_type === 'document' && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {content?.sections ? (
                  (content.sections as Array<{ title: string; content: string }>).map((section, i) => (
                    <div key={i} className="mb-6">
                      <h3 className="text-base font-semibold mb-2">{section.title}</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap text-pretty">{section.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap text-pretty">
                    {String(content?.text || content?.content || '暂无内容')}
                  </p>
                )}
              </div>
            )}

            {resource.resource_type === 'code' && (
              <div className="space-y-4">
                {content?.examples ? (
                  (content.examples as Array<{ title: string; code: string; language: string; description?: string }>).map((ex, i) => (
                    <div key={i}>
                      <h4 className="text-sm font-medium mb-1.5">{ex.title}</h4>
                      {ex.description && <p className="text-xs text-muted-foreground mb-2 text-pretty">{ex.description}</p>}
                      <CodeBlock code={ex.code} language={ex.language} />
                    </div>
                  ))
                ) : (
                  <CodeBlock code={String(content?.code || content?.content || '// 暂无代码')} language={content?.language as string} />
                )}
              </div>
            )}

            {resource.resource_type === 'mindmap' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <h3 className="font-semibold text-sm mb-3 text-center">{String(content?.title || resource.title)}</h3>
                  <div className="space-y-2">
                    {(content?.nodes as Array<{ label: string; children?: string[] }> || []).map((node, i) => (
                      <div key={i} className="ml-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          <span className="text-sm font-medium">{node.label}</span>
                        </div>
                        {node.children?.map((child, j) => (
                          <div key={j} className="ml-6 flex items-center gap-2 mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                            <span className="text-xs text-muted-foreground">{child}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {resource.resource_type === 'exercise' && (
              <div className="space-y-4">
                {(content?.questions as Array<{ question: string; options: string[]; answer: string; explanation: string }> || []).map((q, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border">
                    <p className="font-medium text-sm mb-3">{i + 1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options?.map((opt, j) => (
                        <div key={j} className={`p-2 rounded-lg text-sm ${
                          String.fromCharCode(65 + j) === q.answer
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-muted/50'
                        }`}>
                          {String.fromCharCode(65 + j)}. {opt}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 p-2 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground"><strong>解析：</strong>{q.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {resource.resource_type === 'reading' && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap text-pretty">
                  {String(content?.text || content?.content || '暂无内容')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          创建于 {new Date(resource.created_at).toLocaleString('zh-CN')}
          {resource.updated_at !== resource.created_at && (
            <span> · 更新于 {new Date(resource.updated_at).toLocaleString('zh-CN')}</span>
          )}
        </div>
      </div>
    </AppLayout>
  );
}