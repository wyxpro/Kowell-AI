import { z } from 'zod';
import { cleanJsonCodeBlock, parseAiEvaluationResult } from '@/lib/exercises';
import type { ExerciseAiResult } from '@/types/types';
import { stepfunService, type ChatMessage } from '../stepfun';
import {
  PORTRAIT_SYSTEM_PROMPT,
  TUTORING_SOCRATIC_PROMPT,
  TUTORING_DIRECT_PROMPT,
  RESOURCE_PROMPTS,
  PATH_RECOMMEND_PROMPT,
  EVALUATION_PROMPT
} from './prompts';

export interface TextStreamCallbacks {
  onChunk?: (text: string) => void;
  onThink?: (thinkText: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (err: string) => void;
}

const oralEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)).optional(),
  improvements: z.array(z.string().trim().min(1)).optional()
}).strict();

const essayEvaluationSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string().trim().min(1),
  dimensions: z.array(z.object({
    name: z.string().trim().min(1),
    score: z.number().min(0).max(100)
  }).strict()).optional()
}).strict();

function parseOralEvaluationResult(text: string): ExerciseAiResult {
  const result = oralEvaluationSchema.parse(JSON.parse(cleanJsonCodeBlock(text)));
  return {
    ...result,
    is_correct: false,
    analysis: '',
    suggestions: ''
  };
}

function parseEssayEvaluationResult(text: string): ExerciseAiResult {
  const result = essayEvaluationSchema.parse(JSON.parse(cleanJsonCodeBlock(text)));
  return {
    ...result,
    is_correct: false,
    analysis: '',
    suggestions: ''
  };
}

/**
 * 带有思维链（CoT）过滤的流式 API 桥接函数
 */
export function makeCleanStreamChat(
  messages: ChatMessage[],
  callbacks: TextStreamCallbacks,
  options?: { temperature?: number; signal?: AbortSignal }
): Promise<void> {
  let isThinking = false;
  let fullText = '';

  // 保证系统级提示词存在且不重复
  const cleanMessages = [...messages];

  return stepfunService.streamChat(
    cleanMessages,
    {
      onChunk: (chunk) => {
        let textToEmit = '';
        let thinkToEmit = '';
        let remaining = chunk;

        while (remaining.length > 0) {
          if (!isThinking) {
            const index = remaining.indexOf('<think>');
            if (index !== -1) {
              textToEmit += remaining.substring(0, index);
              isThinking = true;
              remaining = remaining.substring(index + 7);
            } else {
              textToEmit += remaining;
              remaining = '';
            }
          } else {
            const index = remaining.indexOf('</think>');
            if (index !== -1) {
              thinkToEmit += remaining.substring(0, index);
              isThinking = false;
              remaining = remaining.substring(index + 8);
            } else {
              thinkToEmit += remaining;
              remaining = '';
            }
          }
        }

        if (textToEmit) {
          fullText += textToEmit;
          if (callbacks.onChunk) {
            callbacks.onChunk(textToEmit);
          }
        }
        if (thinkToEmit && callbacks.onThink) {
          callbacks.onThink(thinkToEmit);
        }
      },
      onDone: () => {
        if (callbacks.onDone) {
          callbacks.onDone(fullText);
        }
      },
      onError: (err) => {
        if (callbacks.onError) {
          callbacks.onError(err);
        }
      }
    },
    options
  );
}

export const textAIService = {
  /**
   * 1. 对话式画像构建 (Conversational Portrait Building)
   */
  async streamPortraitChat(
    messages: ChatMessage[],
    callbacks: TextStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: PORTRAIT_SYSTEM_PROMPT },
      ...messages.filter(m => m.role !== 'system')
    ];
    return makeCleanStreamChat(chatMessages, callbacks, { temperature: 0.6, signal });
  },

  /**
   * 2. 智能答疑与辅导 (Smart Tutoring & QA)
   * 支持 苏格拉底式启发 (socratic) 和 直接回答 (direct) 模式
   */
  async streamTutoringChat(
    messages: ChatMessage[],
    mode: 'socratic' | 'direct',
    callbacks: TextStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const sysPrompt = mode === 'socratic' ? TUTORING_SOCRATIC_PROMPT : TUTORING_DIRECT_PROMPT;
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: sysPrompt },
      ...messages.filter(m => m.role !== 'system')
    ];
    return makeCleanStreamChat(chatMessages, callbacks, { temperature: 0.7, signal });
  },

  /**
   * 3. 7类个性化资源生成 (7 types of personalized resource generation)
   */
  async streamResourceGeneration(
    params: {
      courseName: string;
      topic: string;
      resourceType: keyof typeof RESOURCE_PROMPTS | string;
      major?: string;
      education?: string;
    },
    callbacks: TextStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const systemPrompt = RESOURCE_PROMPTS[params.resourceType as keyof typeof RESOURCE_PROMPTS] || 
      `你是一位资深的教育专家。请根据用户提供的主题生成对应的学习资源。`;
      
    const userPrompt = `课程名称：${params.courseName}\n主要专业：${params.major || '计算机科学'}\n学历层次：${params.education || '本科'}\n生成主题：${params.topic}`;
    
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    return makeCleanStreamChat(chatMessages, callbacks, { temperature: 0.8, signal });
  },

  /**
   * 4. 智能规划推送 (Smart Path Planning)
   */
  async streamPathRecommendation(
    params: {
      courseName: string;
      currentStage: number;
      historyText: string;
      portraitSummary: string;
    },
    callbacks: TextStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const userPrompt = `课程方向：${params.courseName}\n当前阶段：第${params.currentStage}阶段\n${params.historyText}\n学习画像：${params.portraitSummary}`;
    
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: PATH_RECOMMEND_PROMPT },
      { role: 'user', content: userPrompt }
    ];
    
    return makeCleanStreamChat(chatMessages, callbacks, { temperature: 0.5, signal });
  },

  /**
   * 5. 学习效果评估 (Learning Effectiveness Evaluation)
   */
  async streamEvaluation(
    params: {
      question: string;
      questionType: string;
      correctAnswer: string;
      userAnswer: string;
    },
    callbacks: TextStreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const userPrompt = `题目：${params.question}\n题目类型：${params.questionType}\n标准答案：${params.correctAnswer}\n学生答案：${params.userAnswer}`;
    
    let systemPrompt = EVALUATION_PROMPT;
    if (params.questionType === 'oral') {
      systemPrompt = `你是一位专业的口语表达评估专家。请对学生的口述内容进行打分和评估。
请严格按照以下JSON格式输出，不要有其他内容，不要包裹在 markdown 代码块中：
{
  "score": 85,
  "feedback": "针对学生表达的综合点评（150字以内）",
  "strengths": ["优势要点1", "优势要点2"],
  "improvements": ["改进建议1", "改进建议2"]
}`;
    } else if (params.questionType === 'essay') {
      systemPrompt = `你是一位高校教授。请对学生的学术论述进行多维度评估。
请严格按照以下JSON格式输出，不要有其他内容，不要包裹在 markdown 代码块中：
{
  "score": 85,
  "feedback": "针对学生论述的综合点评（150字以内）",
  "dimensions": [
    {"name": "内容深度", "score": 80},
    {"name": "论证逻辑", "score": 85},
    {"name": "语言表达", "score": 90},
    {"name": "知识准确", "score": 85}
  ]
}`;
    }

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    return makeCleanStreamChat(chatMessages, callbacks, { temperature: 0.3, signal });
  },

  /**
   * 6. 学习效果评估 - 自动判分并解析为 JSON
   */
  async evaluateAnswer(
    params: {
      question: string;
      questionType: string;
      correctAnswer: string;
      userAnswer: string;
    },
    signal?: AbortSignal
  ): Promise<ExerciseAiResult> {
    let fullText = '';
    let streamError: string | undefined;
    await this.streamEvaluation(
      params,
      {
        onChunk: (chunk) => {
          fullText += chunk;
        },
        onError: (error) => {
          streamError = error;
        }
      },
      signal
    );

    if (streamError) throw new Error(`AI 评估请求失败: ${streamError}`);
    if (!fullText.trim()) throw new Error('AI 评估未返回内容');

    if (params.questionType === 'oral') return parseOralEvaluationResult(fullText);
    if (params.questionType === 'essay') return parseEssayEvaluationResult(fullText);
    return parseAiEvaluationResult(fullText);
  },

  /**
   * 7. 智能规划推送 - 自动规划并解析为 JSON
   */
  async recommendPath(
    params: {
      courseName: string;
      currentStage: number;
      historyText: string;
      portraitSummary: string;
    },
    signal?: AbortSignal
  ): Promise<{
    next_topic: string;
    reason: string;
    resources: Array<{ title: string; type: string; priority: string }>;
    focus_points: string[];
    estimated_hours: number;
    difficulty: string;
  }> {
    let fullText = '';
    await this.streamPathRecommendation(
      params,
      {
        onChunk: (chunk) => {
          fullText += chunk;
        }
      },
      signal
    );

    let cleanJson = fullText.trim();
    const match = cleanJson.match(/```(?:json)?([\s\S]*?)```/i);
    if (match) {
      cleanJson = match[1].trim();
    }

    try {
      return JSON.parse(cleanJson);
    } catch (err) {
      console.error('Failed to parse AI recommendation JSON:', fullText, err);
      return {
        next_topic: '进阶拓展',
        reason: '根据您当前的学习进度，为您规划进阶实践内容。',
        resources: [],
        focus_points: ['实践应用', '难点攻坚'],
        estimated_hours: 4,
        difficulty: '中级'
      };
    }
  }
};
