import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, Save, Undo2 } from 'lucide-react';
import type { Resource } from '@/types/types';

export default function ResourceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchResource = async () => {
      const { data } = await supabase.from('resources').select('*').eq('id', id).maybeSingle();
      if (data) {
        setResource(data);
        const content = data.content as Record<string, unknown>;
        setEditContent(JSON.stringify(content, null, 2));
      }
      setLoading(false);
    };
    fetchResource();
  }, [id]);

  const handleSave = async () => {
    if (!resource) return;
    try {
      const parsed = JSON.parse(editContent);
      setSaving(true);
      const { error } = await supabase.from('resources').update({
        content: parsed,
        is_edited: true,
        version: resource.version + 1,
        original_content: resource.content,
      }).eq('id', resource.id);
      if (error) throw error;
      toast.success('保存成功');
      navigate(`/resources/${resource.id}`);
    } catch {
      toast.error('JSON 格式不正确，请检查');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!resource) return;
    const content = resource.content as Record<string, unknown>;
    setEditContent(JSON.stringify(content, null, 2));
    toast.info('已恢复原始内容');
  };

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
            <a href="/resources"><ArrowLeft className="w-4 h-4 mr-2" />返回资源中心</a>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <a href={`/resources/${resource.id}`}><ArrowLeft className="w-4 h-4" /></a>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">编辑资源</h1>
            <p className="text-sm text-muted-foreground truncate">{resource.title}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <Undo2 className="w-4 h-4 mr-1" />重置
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />{saving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">编辑内容 (JSON 格式)</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full h-[60vh] rounded-lg border border-input bg-muted p-4 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}