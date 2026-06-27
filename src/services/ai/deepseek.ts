import { createParser } from 'eventsource-parser';
import { AI_CONFIG } from './config';

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

export const deepseekService = {
  /**
   * 非流式对话调用 (Non-streaming Chat)
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      jsonMode?: boolean;
    }
  ): Promise<string> {
    const url = `${AI_CONFIG.baseUrl}/chat/completions`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Proxy-Key': AI_CONFIG.apiKey,
    };

    const body: Record<string, any> = {
      model: AI_CONFIG.modelName,
      messages: cleanMessages(messages),
      temperature: options?.temperature ?? 0.7,
      stream: false,
    };

    if (options?.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`AI Request Failed (${resp.status}): ${errText || resp.statusText}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined || content === null) {
      throw new Error('AI returned an empty or invalid response');
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
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Proxy-Key': AI_CONFIG.apiKey,
    };

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
        callbacks.onError((err as Error).message);
      }
    } catch (error) {
      callbacks.onError((error as Error).message);
    }
  }
};
export type { ChatMessage as DeepSeekChatMessage, StreamCallbacks as DeepSeekStreamCallbacks };
