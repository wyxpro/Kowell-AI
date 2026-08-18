import { createParser } from 'eventsource-parser';
import { AI_CONFIG } from './config';

const AI_SERVICE_ERROR = 'AI 服务暂不可用，请稍后再试。';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

function cleanMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(m => {
    let content = m.content;
    if (typeof content === 'string') {
      // 移除大模型不支持的 markdown 格式 Base64 图片，防止触发 413 Payload Too Large
      content = content.replace(/!\[(?:图片|上传图片)\]\(data:image\/[^)]+\)/g, '[图片]');
    }
    return { ...m, content };
  });
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey =
    import.meta.env.VITE_DEEPSEEK_API_KEY ||
    import.meta.env.VITE_STEP_API_KEY ||
    'sk-xpFW-5LiEZ20VU9711CVJEbztoowzt5';
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

export const deepseekService = {
  /**
   * 非流式对话调用 (Non-streaming Chat)
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      jsonMode?: boolean;
      signal?: AbortSignal;
    }
  ): Promise<string> {
    const url = `${AI_CONFIG.baseUrl}/chat/completions`;
    const headers = getAuthHeaders();

    const body: Record<string, any> = {
      model: AI_CONFIG.modelName,
      messages: cleanMessages(messages),
      temperature: options?.temperature ?? 0.7,
      stream: false,
    };

    if (options?.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options?.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      throw new Error(AI_SERVICE_ERROR);
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      console.error(`DeepSeek API Non-Stream Error HTTP ${resp.status}:`, errText);
      throw new Error(AI_SERVICE_ERROR);
    }

    let data: any;
    try {
      data = await resp.json();
    } catch {
      throw new Error(AI_SERVICE_ERROR);
    }
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined || content === null) {
      throw new Error(AI_SERVICE_ERROR);
    }
    return content;
  },

  /**
   * SSE流式对话调用 (Streaming Chat via SSE)
   */
  async streamChat(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    options?: {
      temperature?: number;
      signal?: AbortSignal;
    }
  ): Promise<void> {
    const url = `${AI_CONFIG.baseUrl}/chat/completions`;
    const headers = getAuthHeaders();

    const body = {
      model: AI_CONFIG.modelName,
      messages: cleanMessages(messages),
      temperature: options?.temperature ?? 0.7,
      stream: true,
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options?.signal,
      });

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => '');
        console.error(`DeepSeek API Stream Error HTTP ${resp.status}:`, errText);
        callbacks.onError(AI_SERVICE_ERROR);
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
            if (content) {
              callbacks.onChunk(content);
            }
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
        callbacks.onError(AI_SERVICE_ERROR);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') callbacks.onError(AI_SERVICE_ERROR);
    }
  }
};
export type { ChatMessage as DeepSeekChatMessage, StreamCallbacks as DeepSeekStreamCallbacks };
