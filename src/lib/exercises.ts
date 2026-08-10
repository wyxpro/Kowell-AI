import { z } from 'zod';
import type {
  Exercise,
  ExerciseAnswer,
  ExerciseAiResult,
  ExerciseLocalResult,
  ExerciseQuestionType
} from '@/types/types';

const QUESTION_TYPES = ['single', 'multiple', 'subjective'] as const;
const EXERCISE_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

const nonEmptyString = z.string().trim().min(1);

export function cleanJsonCodeBlock(text: string): string {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (match ? match[1] : trimmed).trim();
}

function isQuestionType(value: unknown): value is ExerciseQuestionType {
  return typeof value === 'string' && (QUESTION_TYPES as readonly string[]).includes(value);
}

export function getExerciseQuestionType(
  exercise: Pick<Exercise, 'options' | 'question_type'> | { options?: unknown; question_type?: unknown }
): ExerciseQuestionType {
  if (isQuestionType(exercise.question_type)) return exercise.question_type;
  return Array.isArray(exercise.options) && exercise.options.length > 0 ? 'single' : 'subjective';
}

function optionByIndex(index: number, options: string[]): string | undefined {
  return index >= 0 && index < options.length ? options[index] : undefined;
}

function normalizeOptionText(value: string, options: string[]): string | undefined {
  const text = value.trim();
  if (!text) return undefined;

  const exact = options.find(option => option.trim() === text);
  if (exact !== undefined) return exact;

  const letterOnly = text.match(/^\(?([A-Za-z])\)?\.?$/);
  if (letterOnly) return optionByIndex(letterOnly[1].toUpperCase().charCodeAt(0) - 65, options);

  const letterAndText = text.match(/^\(?([A-Za-z])\)?\.?\s*(.+)$/);
  if (letterAndText) {
    const option = optionByIndex(letterAndText[1].toUpperCase().charCodeAt(0) - 65, options);
    if (option && option.trim() === letterAndText[2].trim()) return option;
  }

  return undefined;
}

export function normalizeSingleAnswer(raw: unknown, options: string[]): string {
  if (typeof raw !== 'string') throw new Error('单选答案必须是字符串');
  const normalized = normalizeOptionText(raw, options);
  if (!normalized) throw new Error('单选答案不是有效选项');
  return normalized;
}

export function normalizeMultipleAnswer(raw: unknown, options: string[]): string[] {
  let values: unknown[];
  if (Array.isArray(raw)) {
    values = raw;
  } else if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) throw new Error('多选答案不能为空');
    if (text.startsWith('[')) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('多选答案 JSON 数组格式无效');
      }
      if (!Array.isArray(parsed)) throw new Error('多选答案必须是数组');
      values = parsed;
    } else {
      values = text.split(/[,，、;；]/);
    }
  } else {
    throw new Error('多选答案必须是数组或字符串');
  }

  const normalized = values.map(value => {
    if (typeof value !== 'string') throw new Error('多选答案项必须是字符串');
    const option = normalizeOptionText(value, options);
    if (!option) throw new Error('多选答案包含无效选项');
    return option;
  });
  const unique = [...new Set(normalized.map(value => value.trim()))];
  if (unique.length === 0) throw new Error('多选答案不能为空');
  return options.filter(option => unique.includes(option.trim()));
}

export function serializeExerciseAnswer(
  answer: ExerciseAnswer,
  questionType: ExerciseQuestionType,
  options: string[] = []
): string {
  if (questionType === 'subjective') {
    if (typeof answer !== 'string') throw new Error('主观题答案必须是字符串');
    return answer;
  }
  if (questionType === 'single') return normalizeSingleAnswer(answer, options);
  return JSON.stringify(normalizeMultipleAnswer(answer, options));
}

export function deserializeExerciseAnswer(
  raw: unknown,
  questionType: ExerciseQuestionType,
  options: string[] = []
): ExerciseAnswer {
  if (questionType === 'subjective') {
    if (typeof raw !== 'string') throw new Error('主观题答案必须是字符串');
    return raw;
  }
  if (questionType === 'single') return normalizeSingleAnswer(raw, options);
  return normalizeMultipleAnswer(raw, options);
}

export function gradeObjectiveExercise(
  exercise: Pick<Exercise, 'question_type' | 'options' | 'answer'>,
  userAnswer: unknown
): ExerciseLocalResult | null {
  const questionType = getExerciseQuestionType(exercise);
  if (questionType === 'subjective') return null;

  try {
    if (questionType === 'single') {
      const expected = normalizeSingleAnswer(exercise.answer, exercise.options);
      const actual = normalizeSingleAnswer(userAnswer, exercise.options);
      const isCorrect = actual === expected;
      return {
        is_correct: isCorrect,
        score: isCorrect ? 100 : 0
      };
    }
    const expected = normalizeMultipleAnswer(exercise.answer, exercise.options);
    const actual = normalizeMultipleAnswer(userAnswer, exercise.options);
    const isCorrect = expected.length === actual.length && expected.every((value, index) => value === actual[index]);
    return { is_correct: isCorrect, score: isCorrect ? 100 : 0 };
  } catch {
    return { is_correct: false, score: 0 };
  }
}

const generatedExerciseCommon = {
  question: nonEmptyString,
  explanation: nonEmptyString,
  difficulty: z.enum(EXERCISE_DIFFICULTIES)
};

const generatedExerciseSchema = z.discriminatedUnion('question_type', [
  z.object({
    ...generatedExerciseCommon,
    question_type: z.literal('single'),
    options: z.array(nonEmptyString).min(1),
    answer: nonEmptyString
  }).strict(),
  z.object({
    ...generatedExerciseCommon,
    question_type: z.literal('multiple'),
    options: z.array(nonEmptyString).min(1),
    answer: z.union([z.array(nonEmptyString).min(1), nonEmptyString])
  }).strict(),
  z.object({
    ...generatedExerciseCommon,
    question_type: z.literal('subjective'),
    options: z.array(nonEmptyString).length(0),
    answer: nonEmptyString
  }).strict()
]);

const generatedExercisesSchema = z.array(generatedExerciseSchema).length(5).superRefine((exercises, context) => {
  for (const questionType of QUESTION_TYPES) {
    if (!exercises.some(exercise => exercise.question_type === questionType)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `生成练习必须包含${questionType}题型`
      });
    }
  }
});

export interface GeneratedExercise {
  question_type: ExerciseQuestionType;
  question: string;
  options: string[];
  answer: ExerciseAnswer;
  explanation: string;
  difficulty: typeof EXERCISE_DIFFICULTIES[number];
}

export function parseGeneratedExercises(text: string): GeneratedExercise[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonCodeBlock(text));
  } catch {
    throw new Error('生成练习不是有效 JSON');
  }

  const exercises = generatedExercisesSchema.parse(parsed);
  return exercises.map(item => {
    const options = item.options.map(option => option.trim());
    if (new Set(options).size !== options.length) throw new Error('练习选项不能重复');
    if (item.question_type === 'subjective') {
      return { ...item, options: [], answer: item.answer.trim() };
    }
    const answer = item.question_type === 'single'
      ? normalizeSingleAnswer(item.answer, options)
      : normalizeMultipleAnswer(item.answer, options);
    return { ...item, options, answer };
  });
}

const aiEvaluationSchema = z.object({
  is_correct: z.boolean(),
  score: z.number().int().min(0).max(100),
  feedback: nonEmptyString,
  analysis: nonEmptyString,
  suggestions: nonEmptyString
}).strict();

export function parseAiEvaluationResult(text: string): ExerciseAiResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonCodeBlock(text));
  } catch {
    throw new Error('AI 评估结果不是有效 JSON');
  }
  return aiEvaluationSchema.parse(parsed);
}
