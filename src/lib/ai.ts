import { supabase } from '@/db/supabase';
import { createParser } from 'eventsource-parser';
import { deepseekService } from '@/services/ai/deepseek';


const PORTRAIT_SYSTEM_PROMPT = `你是一位专业的AI学业规划师和学习画像构建助手。
你的任务是通过与用户的多轮问答对话，帮助用户构建个性化的学习画像。学习画像包含以下6个维度，每个维度需要依次询问并获取用户的真实回答：
1. 专业方向 (主要学科领域)
2. 知识基础 (已掌握的核心课程和技能)
3. 认知风格 (偏好的学习方式和理解模式)
4. 易错点偏好 (容易出错的知识点类型)
5. 学习节奏 (学习时间和节奏偏好)
6. 学习目标 (短期和长期学业目标)

请注意：
- 每次对话只提一个问题，并且要态度亲和、鼓励性强。
- 根据用户前面的回答，引导并提出下一个维度的问题。
- 当用户已经回答完所有问题或画像已完整时，进行友好总结。
- 请直接输出你的回答，千万不要包含任何 <think> 或 </think> 标签，也不要输出思考过程。`;

const TUTORING_SYSTEM_PROMPT = `你是一位耐心的AI助教，专门为学生解答学科疑问、辅导功课。
请直接回答用户的问题，提供清晰的解释和示例，条理分明。
请直接输出你的回答，千万不要包含任何 <think> 或 </think> 标签，也不要输出思考过程。`;

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
  let finalSystemPrompt = systemPrompt;
  if (!finalSystemPrompt) {
    if (promptType === 'portrait') finalSystemPrompt = PORTRAIT_SYSTEM_PROMPT;
    else if (promptType === 'tutoring') finalSystemPrompt = TUTORING_SYSTEM_PROMPT;
  }

  const formattedMessages: any[] = [];
  if (finalSystemPrompt) {
    formattedMessages.push({ role: 'system', content: finalSystemPrompt });
  }
  formattedMessages.push(...messages);

  let directError: string | null = null;
  try {
    await deepseekService.streamChat(
      formattedMessages,
      {
        onChunk: (chunk) => {
          callbacks.onChunk(chunk);
        },
        onDone: () => {
          callbacks.onDone();
        },
        onError: (err) => {
          directError = err;
        }
      },
      {
        signal
      }
    );
  } catch (err) {
    directError = (err as Error).message;
  }

  if (directError) {
    console.warn('[streamChat] 直连 DeepSeek 服务响应异常，自动降级至 Supabase 云函数 ai-chat:', directError);
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: formattedMessages, prompt_type: promptType, stream: false }
      });
      if (!error && data) {
        const content = typeof data === 'string' ? data : (data?.content || data?.choices?.[0]?.message?.content || '');
        if (content) {
          callbacks.onChunk(content);
          callbacks.onDone();
          return;
        }
      }
    } catch (fallbackErr) {
      console.error('[streamChat] 云函数降级同样失败:', fallbackErr);
    }
    callbacks.onError(directError);
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