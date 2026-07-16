import { createParser } from 'eventsource-parser';
import { STEPFUN_CONFIG } from '../stepfun/config';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface VisionStreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/**
 * 转换消息格式以适配 Step-3.7-Flash 多模态推理格式
 * 会自动提取 Markdown 格式的图片语法 ![图片](data:image/...) 并将其包装为 image_url 结构
 */
export function convertToStepMultimodalMessages(messages: ChatMessage[]) {
  return messages.map(m => {
    if (m.role !== 'user') {
      return { role: m.role, content: m.content };
    }
    
    const contentStr = m.content;
    const imgRegex = /!\[(?:图片|上传图片)\]\((data:image\/[^)]+)\)/g;
    const matches = [...contentStr.matchAll(imgRegex)];
    
    if (matches.length === 0) {
      return { role: m.role, content: m.content };
    }
    
    const cleanText = contentStr.replace(imgRegex, '').trim();
    const contentArray: any[] = [];
    
    if (cleanText) {
      contentArray.push({
        type: 'text',
        text: cleanText
      });
    }
    
    matches.forEach(match => {
      const imageUrl = match[1];
      contentArray.push({
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      });
    });
    
    return {
      role: m.role,
      content: contentArray
    };
  });
}

export const visionAIService = {
  /**
   * 课程多模态配图 - 使用 step-image-edit-2 图像生成模型
   */
  async generateImage(prompt: string, options?: { size?: string; n?: number }): Promise<string[]> {
    const url = `/api/stepfun/images/generations`;
    const body = {
      model: 'step-image-edit-2',
      prompt: prompt,
      n: options?.n ?? 1,
      size: options?.size ?? '1024x1024'
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(STEPFUN_CONFIG.apiKey ? { 'Authorization': `Bearer ${STEPFUN_CONFIG.apiKey}` } : {}),
        },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`StepFun Image Generation API failed (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      return (data.data ?? []).map((item: any) => item.url).filter(Boolean);
    } catch (e) {
      console.error('Failed to generate image via step-image-edit-2:', e);
      throw e;
    }
  },

  /**
   * 拍照搜题 (OCR) 与结构化提取 - 使用 step-3.7-flash 视觉模型
   */
  async recognizeAndAnalyzeQuestion(
    base64Image: string,
    prompt = '请对该图片进行分析，如果是题目，请提取出题目的文字、题目类型，并给出详细的解答步骤。'
  ): Promise<{ question: string; question_type: string; correct_answer: string; analysis: string }> {
    const url = `/api/stepfun/chat/completions`;
    
    const imageUrl = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;

    const messages = [
      {
        role: 'system',
        content: `你是一个专业的智能学习助手，能够识图搜题。
请严格以下列 JSON 格式输出，不要输出任何 markdown 标签或多余解释：
{
  "question": "提取的题目内容及文字",
  "question_type": "单选题 / 多选题 / 填空题 / 简答题",
  "correct_answer": "正确答案",
  "analysis": "详细的解题步骤、核心概念及思路解析"
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ];

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(STEPFUN_CONFIG.apiKey ? { 'Authorization': `Bearer ${STEPFUN_CONFIG.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: 'step-3.7-flash',
          messages,
          temperature: 0.1,
          stream: false,
          response_format: { type: 'json_object' }
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`StepFun Chat API Failed (${resp.status}): ${errText}`);
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      
      try {
        const parsed = JSON.parse(content);
        return {
          question: parsed.question ?? '未能识别题目文本',
          question_type: parsed.question_type ?? '简答题',
          correct_answer: parsed.correct_answer ?? '无法确定',
          analysis: parsed.analysis ?? '分析出错，请重试'
        };
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            return JSON.parse(match[0]);
          } catch {}
        }
        return {
          question: '未能成功识别图片题目文字',
          question_type: '未知',
          correct_answer: '未知',
          analysis: content || '未返回详细解析'
        };
      }
    } catch (e) {
      console.error('Failed to recognize image question:', e);
      throw e;
    }
  },

  /**
   * 拍照搜题 (OCR) 与多模态流式会话 - 使用 step-3.7-flash 支持实时流式打字机渲染
   */
  async streamOCRAnalysis(
    messages: ChatMessage[],
    callbacks: VisionStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const url = `/api/stepfun/chat/completions`;
    const formattedMessages = convertToStepMultimodalMessages(messages);

    const body = {
      model: 'step-3.7-flash',
      messages: formattedMessages,
      temperature: 0.3,
      stream: true
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(STEPFUN_CONFIG.apiKey ? { 'Authorization': `Bearer ${STEPFUN_CONFIG.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal
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
            // ignore malformed chunks
          }
        }
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
