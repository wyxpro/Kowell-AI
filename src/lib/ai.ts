import { supabase } from '@/db/supabase';
import { createParser } from 'eventsource-parser';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function streamChat(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  promptType: 'tutoring' | 'portrait' | 'resource' = 'tutoring',
  signal?: AbortSignal,
  systemPrompt?: string
) {
  try {
    const response = await supabase.functions.invoke<ReadableStream>('ai-chat', {
      method: 'POST',
      body: { messages, prompt_type: promptType, system_prompt: systemPrompt },
    });

    if (response.error) {
      const errorMsg = await response.error?.context?.text?.() || response.error.message;
      callbacks.onError(errorMsg);
      return;
    }

    // 由于 Supabase functions.invoke 返回的是 parsed data，我们改用 fetch 直接调用
  } catch {
    // 回退到直接 fetch
  }

  // 直接 fetch 调用 Edge Function 获取 SSE 流
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ messages, prompt_type: promptType, system_prompt: systemPrompt }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    callbacks.onError(`请求失败: ${resp.status}`);
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf8');
  const parser = createParser({
    onEvent: (event) => {
      if (!event.data || event.data === '[DONE]') return;
      try {
        const chunk = JSON.parse(event.data);
        const content = chunk.choices?.[0]?.delta?.content ?? '';
        if (content) callbacks.onChunk(content);
      } catch {
        // skip malformed
      }
    },
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
    }
    callbacks.onDone();
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    callbacks.onError((err as Error).message);
  }
}

export async function generateResource(
  params: {
    course_name: string;
    topic: string;
    resource_type: string;
    major?: string;
    education?: string;
  }
): Promise<{ content: string; type: string }> {
  const { data, error } = await supabase.functions.invoke<{ content: string; type: string }>('ai-generate', {
    method: 'POST',
    body: params,
  });

  if (error) {
    const errorMsg = await error?.context?.text?.() || error.message;
    throw new Error(errorMsg);
  }

  if (!data) throw new Error('未返回数据');

  // 净化内容：去除所有 * 符号（Markdown 加粗/列表），转为结构化纯文本
  const cleanContent = (raw: string) => {
    return raw
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // 去除 **bold** / *italic* / ***bold-italic***
      .replace(/^\s*\*+\s+/gm, '• ')            // 将 * 列表项替换为 • 符号
      .replace(/^\s*#{1,6}\s+/gm, '')           // 可选：去除 markdown 标题符号（保留文字）
      .replace(/\n{3,}/g, '\n\n')               // 合并多余空行
      .trim();
  };

  return { ...data, content: cleanContent(data.content) };
}