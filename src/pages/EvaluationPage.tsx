import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { textAIService } from '@/services/ai';
import AppLayout from '@/components/layouts/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3, TrendingUp, Target, Zap, AlertTriangle, ArrowRight,
  CheckCircle, Brain, BookOpen, Clock, BookMarked, Loader2,
  Mic, MicOff, Square, FileText, Lightbulb, Star, RefreshCw,
  MessageSquare, PenTool, Library,
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend, LineChart, Line,
  CartesianGrid, XAxis, YAxis,
} from 'recharts';
import {
  deserializeExerciseAnswer,
  getExerciseQuestionType,
  gradeObjectiveExercise,
  serializeExerciseAnswer,
} from '@/lib/exercises';
import { getLearningReportData, recordExerciseSubmitted, triggerLearningAdapt } from '@/services/learning/service';
import type {
  Evaluation,
  Exercise,
  ExerciseAiResult,
  ExerciseLocalResult,
  ExerciseQuestionType,
  ExerciseSubmission,
  KnowledgeMastery,
} from '@/types/types';

interface ExerciseState {
  selectedAnswer: string | string[];
  submitted: boolean;
  submissionStatus: 'idle' | 'saving' | 'saved' | 'failed';
  aiStatus: 'idle' | 'pending' | 'completed' | 'failed';
  localResult: ExerciseLocalResult | null;
  aiResult: ExerciseAiResult | null;
  submissionId: string | null;
  submissionError: string | null;
  aiError: string | null;
  startTime: number | null;
  timeSpent: number | null;
}

type ExerciseSource = { id: string; title: string; chapter: string | null };
type ExerciseSubmissionRow = ExerciseSubmission & {
  exercises: { question_type?: unknown; options?: unknown } | null;
};
type KnowledgePointRow = { id: string; title: string };

const initialExerciseState = (): ExerciseState => ({
  selectedAnswer: '',
  submitted: false,
  submissionStatus: 'idle',
  aiStatus: 'idle',
  localResult: null,
  aiResult: null,
  submissionId: null,
  submissionError: null,
  aiError: null,
  startTime: null,
  timeSpent: null,
});

const questionTypeLabels: Record<ExerciseQuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  subjective: '简答题',
};

export default function EvaluationPage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [submissions, setSubmissions] = useState<ExerciseSubmission[]>([]);
  const [submissionQuestionTypes, setSubmissionQuestionTypes] = useState<Record<string, ExerciseQuestionType>>({});
  const [exerciseKnowledgePointIds, setExerciseKnowledgePointIds] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [mastery, setMastery] = useState<KnowledgeMastery[]>([]);
  const [knowledgePointTitles, setKnowledgePointTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'practice' | 'oral' | 'essay' | 'history'>('practice');
  const [exState, setExState] = useState<Record<string, ExerciseState>>({});
  const aiControllers = useRef<Record<string, AbortController>>({});
  const aiRequestVersions = useRef<Record<string, number>>({});
  const submissionLocks = useRef(new Set<string>());
  const mountedRef = useRef(true);

  // 口述评估状态
  const [oralTopic, setOralTopic] = useState('');
  const [oralRecording, setOralRecording] = useState(false);
  const [oralText, setOralText] = useState('');
  const [oralResult, setOralResult] = useState<{ score: number; feedback: string; strengths: string[]; improvements: string[] } | null>(null);
  const [oralError, setOralError] = useState<string | null>(null);
  const [oralLoading, setOralLoading] = useState(false);

  // 综合论述评估状态
  const [essayTopic, setEssayTopic] = useState('');
  const [essayContent, setEssayContent] = useState('');
  const [essayResult, setEssayResult] = useState<{ score: number; feedback: string; dimensions: { name: string; score: number }[] } | null>(null);
  const [essayError, setEssayError] = useState<string | null>(null);
  const [essayLoading, setEssayLoading] = useState(false);

  // 资源中心练习题来源
  const [exerciseSources, setExerciseSources] = useState<ExerciseSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('all');

  const setExerciseState = (exerciseId: string, updater: (state: ExerciseState) => ExerciseState) => {
    if (!mountedRef.current) return;
    setExState(previous => ({
      ...previous,
      [exerciseId]: updater(previous[exerciseId] ?? initialExerciseState()),
    }));
  };

  const upsertSubmission = (submission: ExerciseSubmission) => {
    if (!mountedRef.current) return;
    setSubmissions(previous => [
      submission,
      ...previous.filter(item => item.id !== submission.id),
    ]);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      Object.values(aiControllers.current).forEach(controller => controller.abort());
      aiControllers.current = {};
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadExercises = async () => {
      setLoading(true);
      const resourcesResult = await supabase.from('resources')
        .select('id,title,chapter')
        .eq('user_id', user.id)
        .eq('resource_type', 'exercise')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);
      if (resourcesResult.error) {
        toast.error(`练习资源加载失败：${resourcesResult.error.message}`);
      }

      const resources = (resourcesResult.data ?? []) as ExerciseSource[];
      const resourceIds = resources.map(resource => resource.id);
      const exercisesQuery = supabase.from('exercises').select('*').order('created_at', { ascending: false }).limit(50);
      const exercisesResult = resourceIds.length > 0
        ? await exercisesQuery.or(`resource_id.is.null,resource_id.in.(${resourceIds.join(',')})`)
        : await exercisesQuery.is('resource_id', null);
      let submissionsResult = await supabase.from('user_exercise_submissions')
        .select('*, exercises(question_type, options)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (submissionsResult.error && submissionsResult.error.message.includes('question_type')) {
        console.warn('exercises 表缺失 question_type 列，降级查询:', submissionsResult.error.message);
        submissionsResult = await supabase.from('user_exercise_submissions')
          .select('*, exercises(options)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
      }
      const exerciseIds = (exercisesResult.data ?? []).map(exercise => exercise.id);
      const [exerciseKnowledgePointsResult, learningReportResult] = await Promise.all([
        exerciseIds.length > 0
          ? supabase.from('exercise_knowledge_points').select('exercise_id, knowledge_point_id').in('exercise_id', exerciseIds)
          : Promise.resolve({ data: [], error: null }),
        getLearningReportData().catch(error => {
          console.warn('学习概览数据加载失败：', error);
          return null;
        }),
      ]);
      const knowledgePointIds = [...new Set((exerciseKnowledgePointsResult.data ?? []).map(row => row.knowledge_point_id))];
      const knowledgePointsResult = knowledgePointIds.length > 0
        ? await supabase.from('knowledge_points').select('id, title').in('id', knowledgePointIds)
        : { data: [], error: null };

      if (exercisesResult.error) toast.error(`练习题加载失败：${exercisesResult.error.message}`);
      if (submissionsResult.error) toast.error(`答题记录加载失败：${submissionsResult.error.message}`);
      if (exerciseKnowledgePointsResult.error) console.warn('练习知识点映射加载失败：', exerciseKnowledgePointsResult.error.message);
      if (knowledgePointsResult.error) console.warn('知识点名称加载失败：', knowledgePointsResult.error.message);
      if (cancelled || !mountedRef.current) return;

      const sourceById = new Map(resources.map(resource => [resource.id, resource]));
      const loadedExercises = ((exercisesResult.data ?? []) as Exercise[]).map(exercise => {
        const source = exercise.resource_id ? sourceById.get(exercise.resource_id) : undefined;
        return source
          ? { ...exercise, source_resource_id: source.id, source_title: source.title }
          : exercise;
      });
      const exerciseSourceIds = new Set(loadedExercises.flatMap(exercise => exercise.resource_id ? [exercise.resource_id] : []));
      const availableSources = resources.filter(resource => exerciseSourceIds.has(resource.id));
      const skippedSources = resources.filter(resource => !exerciseSourceIds.has(resource.id));
      if (skippedSources.length > 0) {
        console.warn('已跳过没有结构化题目行的练习资源:', skippedSources.map(resource => resource.id));
      }
      const submissionRows = (submissionsResult.data ?? []) as ExerciseSubmissionRow[];
      const loadedSubmissions: ExerciseSubmission[] = submissionRows;
      const loadedSubmissionQuestionTypes = submissionRows.reduce<Record<string, ExerciseQuestionType>>((result, submission) => {
        result[submission.exercise_id] = getExerciseQuestionType(submission.exercises ?? {});
        return result;
      }, {});
      const newestByExercise = new Map<string, ExerciseSubmission>();
      loadedSubmissions.forEach(submission => {
        if (!newestByExercise.has(submission.exercise_id)) newestByExercise.set(submission.exercise_id, submission);
      });
      const knowledgePointByExercise = (exerciseKnowledgePointsResult.data ?? []).reduce<Record<string, string>>((result, row) => {
        if (!result[row.exercise_id]) result[row.exercise_id] = row.knowledge_point_id;
        return result;
      }, {});
      const titlesByKnowledgePoint = ((knowledgePointsResult.data ?? []) as KnowledgePointRow[]).reduce<Record<string, string>>((result, point) => {
        result[point.id] = point.title;
        return result;
      }, {});

      setExerciseSources(availableSources);
      setExercises(loadedExercises);
      setSubmissions(loadedSubmissions);
      setSubmissionQuestionTypes(loadedSubmissionQuestionTypes);
      setExerciseKnowledgePointIds(knowledgePointByExercise);
      setEvaluations(learningReportResult?.evaluations ?? []);
      setMastery(learningReportResult?.mastery ?? []);
      setKnowledgePointTitles(titlesByKnowledgePoint);
      setExState(previous => {
        const next = { ...previous };
        newestByExercise.forEach((submission, exerciseId) => {
          if (next[exerciseId]) return;
          const exercise = loadedExercises.find(item => item.id === exerciseId);
          const questionType = exercise ? getExerciseQuestionType(exercise) : 'subjective';
          let selectedAnswer: string | string[] = submission.user_answer;
          if (exercise) {
            try {
              selectedAnswer = deserializeExerciseAnswer(submission.user_answer, questionType, exercise.options);
            } catch {
              selectedAnswer = questionType === 'multiple' ? [] : submission.user_answer;
            }
          }
          const hasObjectiveResult = questionType !== 'subjective' && submission.is_correct !== null;
          const hasSubjectiveResult = questionType === 'subjective'
            && submission.is_correct !== null
            && submission.ai_score !== null;
          const hasAiText = Boolean(submission.ai_feedback || submission.ai_analysis || submission.ai_suggestions);
          const hasAiResult = submission.ai_status === 'completed'
            && (questionType === 'subjective' ? hasSubjectiveResult : hasAiText);
          const restoredAiStatus = submission.ai_status === 'completed' && hasAiResult
            ? 'completed'
            : submission.ai_status === 'pending'
              ? 'pending'
              : 'failed';
          next[exerciseId] = {
            ...initialExerciseState(),
            selectedAnswer,
            submitted: true,
            submissionStatus: 'saved',
            aiStatus: restoredAiStatus,
            localResult: hasObjectiveResult
              ? { is_correct: submission.is_correct as boolean, score: submission.is_correct ? 100 : 0 }
              : null,
            aiResult: hasAiResult
              ? {
                is_correct: submission.is_correct ?? false,
                score: questionType === 'subjective' ? Number(submission.ai_score) : (submission.is_correct ? 100 : 0),
                feedback: submission.ai_feedback ?? '',
                analysis: submission.ai_analysis ?? '',
                suggestions: submission.ai_suggestions ?? '',
              }
              : null,
            submissionId: submission.id,
            timeSpent: submission.time_spent,
            aiError: submission.ai_status === 'failed'
              ? '上次 AI 评估失败，可重新发起'
              : submission.ai_status === 'pending'
                ? '上次 AI 评估尚未完成，可重新发起'
                : submission.ai_status === 'completed' && !hasAiResult
                  ? '历史记录缺少完整 AI 反馈，可重新发起'
                  : submission.ai_status === 'skipped'
                    ? '历史记录尚未进行 AI 评估，可重新发起'
                    : null,
          };
        });
        return next;
      });
      setLoading(false);
    };

    void loadExercises();
    return () => { cancelled = true; };
  }, [user]);

  const updateAnswer = (exerciseId: string, answer: string | string[]) => {
    setExerciseState(exerciseId, state => state.submitted ? state : {
      ...state,
      selectedAnswer: answer,
      startTime: state.startTime ?? Date.now(),
    });
  };

  const addWrongBookEntry = async (exerciseId: string, submissionId: string) => {
    if (!user) return;
    const { error } = await supabase.from('wrong_book').upsert({
      user_id: user.id,
      exercise_id: exerciseId,
      submission_id: submissionId,
    }, { onConflict: 'user_id,exercise_id' });
    if (error) toast.error(`错题本保存失败：${error.message}`);
  };

  const recordSubmissionLearningEvent = async (
    exercise: Exercise,
    submission: ExerciseSubmission,
    phase: 'submitted' | 'ai-scored',
  ) => {
    try {
      const event = await recordExerciseSubmitted({
        eventType: 'exercise_submitted',
        exerciseId: exercise.id,
        submissionId: submission.id,
        knowledgePointId: exerciseKnowledgePointIds[exercise.id] ?? null,
        idempotencyKey: `exercise-submission:${submission.id}:${phase}:${phase === 'ai-scored' ? submission.ai_request_id ?? 'completed' : 'initial'}`,
        payload: {
          is_correct: submission.is_correct,
          ai_score: submission.ai_score,
          attempt_no: 1,
          references: {
            exercise_id: exercise.id,
            submission_id: submission.id,
          },
        },
      });
      void triggerLearningAdapt(event.id).catch(error => {
        console.warn('学习适配触发失败，不影响答题结果：', error);
      });
    } catch (error) {
      console.warn('学习事件记录失败，不影响答题结果：', error);
    }
  };

  const runAiEvaluation = async (
    exercise: Exercise,
    answer: string | string[],
    submissionId: string,
    existingRequestId?: string,
  ) => {
    if (!user || !mountedRef.current || aiControllers.current[exercise.id]) return;
    const version = (aiRequestVersions.current[exercise.id] ?? 0) + 1;
    aiRequestVersions.current[exercise.id] = version;
    const controller = new AbortController();
    aiControllers.current[exercise.id] = controller;
    const questionType = getExerciseQuestionType(exercise);
    const requestId = existingRequestId ?? crypto.randomUUID();

    setExerciseState(exercise.id, state => ({ ...state, aiStatus: 'pending', aiError: null }));
    try {
      if (!existingRequestId) {
        const { data: pendingSubmission, error: pendingError } = await supabase.from('user_exercise_submissions')
          .update({ ai_status: 'pending', ai_request_id: requestId })
          .eq('id', submissionId)
          .eq('user_id', user.id)
          .select('*')
          .single();
        if (pendingError) throw pendingError;
        if (aiRequestVersions.current[exercise.id] !== version) return;
        if (!mountedRef.current || controller.signal.aborted) throw new Error('AI 评估已中断');
        upsertSubmission(pendingSubmission as ExerciseSubmission);
      }

      const serializedAnswer = serializeExerciseAnswer(answer, questionType, exercise.options);
      const aiResult = await textAIService.evaluateAnswer({
        question: exercise.question,
        questionType,
        correctAnswer: exercise.answer,
        userAnswer: serializedAnswer,
      }, controller.signal);
      if (aiRequestVersions.current[exercise.id] !== version) return;
      if (!mountedRef.current || controller.signal.aborted) throw new Error('AI 评估已中断');

      const updates = questionType === 'subjective'
        ? {
          is_correct: aiResult.is_correct,
          ai_score: aiResult.score,
          ai_feedback: aiResult.feedback,
          ai_analysis: aiResult.analysis,
          ai_suggestions: aiResult.suggestions,
          ai_status: 'completed',
        }
        : {
          ai_feedback: aiResult.feedback,
          ai_analysis: aiResult.analysis,
          ai_suggestions: aiResult.suggestions,
          ai_status: 'completed',
        };
      const { data: updatedSubmission, error } = await supabase.from('user_exercise_submissions')
        .update(updates)
        .eq('id', submissionId)
        .eq('user_id', user.id)
        .eq('ai_request_id', requestId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!updatedSubmission || !mountedRef.current || aiRequestVersions.current[exercise.id] !== version) return;

      const completedSubmission = updatedSubmission as ExerciseSubmission;
      upsertSubmission(completedSubmission);
      setExerciseState(exercise.id, state => ({
        ...state,
        aiStatus: 'completed',
        aiResult,
        aiError: null,
      }));
      if (questionType === 'subjective') {
        void recordSubmissionLearningEvent(exercise, completedSubmission, 'ai-scored');
        if (!aiResult.is_correct) void addWrongBookEntry(exercise.id, submissionId);
      }
    } catch (error) {
      if (aiRequestVersions.current[exercise.id] !== version) return;
      const message = controller.signal.aborted
        ? 'AI 评估已中断，可重新发起'
        : error instanceof Error
          ? error.message
          : 'AI 解析失败';
      const failureQuery = supabase.from('user_exercise_submissions')
        .update({ ai_status: 'failed' })
        .eq('id', submissionId)
        .eq('user_id', user.id)
        .eq('ai_request_id', requestId);
      const { data: failedSubmission, error: updateError } = await failureQuery
        .select('*')
        .maybeSingle();
      if (mountedRef.current) {
        if (updateError) toast.error(`AI 状态保存失败：${updateError.message}`);
        else if (failedSubmission) upsertSubmission(failedSubmission as ExerciseSubmission);
        setExerciseState(exercise.id, state => ({ ...state, aiStatus: 'failed', aiError: message }));
      }
    } finally {
      if (aiControllers.current[exercise.id] === controller) delete aiControllers.current[exercise.id];
    }
  };

  const persistSubmission = async (
    exercise: Exercise,
    answer: string | string[],
    timeSpent: number,
    localResult: ExerciseLocalResult | null,
    submissionId: string,
  ) => {
    if (!user) return;
    const questionType = getExerciseQuestionType(exercise);
    try {
      const userAnswer = serializeExerciseAnswer(answer, questionType, exercise.options);
      const aiRequestId = crypto.randomUUID();
      let data: any = null;
      let error: any = null;
      const fullPayload = {
        id: submissionId,
        user_id: user.id,
        exercise_id: exercise.id,
        user_answer: userAnswer,
        is_correct: localResult?.is_correct ?? null,
        ai_score: localResult?.score ?? null,
        ai_feedback: null,
        ai_status: 'pending',
        ai_analysis: null,
        ai_suggestions: null,
        ai_request_id: aiRequestId,
        time_spent: timeSpent,
      };
      const res = await supabase.from('user_exercise_submissions').upsert(fullPayload, { onConflict: 'id' }).select('*').single();
      data = res.data;
      error = res.error;

      if (error) {
        console.warn('user_exercise_submissions 完整字段写入异常，平滑切换基础字段提交:', error.message);
        const basicPayload = {
          id: submissionId,
          user_id: user.id,
          exercise_id: exercise.id,
          user_answer: userAnswer,
          is_correct: localResult?.is_correct ?? null,
          ai_score: localResult?.score ?? null,
          time_spent: timeSpent,
        };
        const fallbackRes = await supabase.from('user_exercise_submissions').upsert(basicPayload, { onConflict: 'id' }).select('*').single();
        data = fallbackRes.data;
        error = fallbackRes.error;
      }
      if (error) throw error;
      const submission = data as ExerciseSubmission;
      if (localResult && !localResult.is_correct) void addWrongBookEntry(exercise.id, submission.id);
      if (!mountedRef.current) {
        await supabase.from('user_exercise_submissions')
          .update({ ai_status: 'failed' })
          .eq('id', submission.id)
          .eq('user_id', user.id)
          .eq('ai_request_id', aiRequestId);
        return;
      }
      setSubmissionQuestionTypes(previous => ({ ...previous, [exercise.id]: questionType }));
      upsertSubmission(submission);
      void recordSubmissionLearningEvent(exercise, submission, 'submitted');
      setExerciseState(exercise.id, state => ({
        ...state,
        submissionStatus: 'saved',
        aiStatus: 'pending',
        submissionId: submission.id,
        submissionError: null,
      }));
      void runAiEvaluation(exercise, answer, submission.id, aiRequestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '答题记录保存失败';
      setExerciseState(exercise.id, state => ({
        ...state,
        submissionStatus: 'failed',
        aiStatus: 'idle',
        submissionError: message,
        aiError: null,
      }));
    } finally {
      submissionLocks.current.delete(exercise.id);
    }
  };

  const handleSubmitAnswer = (exercise: Exercise) => {
    if (!user || submissionLocks.current.has(exercise.id)) return;
    const state = exState[exercise.id] ?? initialExerciseState();
    if (state.submitted) return;
    const questionType = getExerciseQuestionType(exercise);
    const answerIsEmpty = typeof state.selectedAnswer === 'string'
      ? !state.selectedAnswer.trim()
      : state.selectedAnswer.length === 0;
    if (answerIsEmpty) {
      toast.warning(questionType === 'multiple' ? '请至少选择一个答案' : '请先填写答案');
      return;
    }

    submissionLocks.current.add(exercise.id);
    const localResult = gradeObjectiveExercise(exercise, state.selectedAnswer);
    const timeSpent = Math.max(0, Math.round((Date.now() - (state.startTime ?? Date.now())) / 1000));
    const submissionId = crypto.randomUUID();
    setExerciseState(exercise.id, current => ({
      ...current,
      submitted: true,
      submissionStatus: 'saving',
      aiStatus: 'pending',
      localResult,
      aiResult: null,
      submissionId,
      submissionError: null,
      aiError: null,
      timeSpent,
    }));
    void persistSubmission(exercise, state.selectedAnswer, timeSpent, localResult, submissionId);
  };

  const retrySubmission = (exercise: Exercise) => {
    if (!user || submissionLocks.current.has(exercise.id)) return;
    const state = exState[exercise.id];
    if (!state?.submitted || state.submissionStatus !== 'failed' || !state.submissionId) return;

    submissionLocks.current.add(exercise.id);
    setExerciseState(exercise.id, current => ({
      ...current,
      submissionStatus: 'saving',
      aiStatus: 'pending',
      submissionError: null,
      aiError: null,
    }));
    void persistSubmission(
      exercise,
      state.selectedAnswer,
      state.timeSpent ?? 0,
      state.localResult,
      state.submissionId,
    );
  };

  const retryAiEvaluation = (exercise: Exercise) => {
    const state = exState[exercise.id];
    if (!state?.submissionId || !user) return;
    void runAiEvaluation(exercise, state.selectedAnswer, state.submissionId);
  };

  const exerciseTypeById = useMemo(() => {
    const questionTypes = new Map<string, ExerciseQuestionType>();
    Object.entries(submissionQuestionTypes).forEach(([exerciseId, questionType]) => {
      questionTypes.set(exerciseId, questionType);
    });
    exercises.forEach(exercise => {
      questionTypes.set(exercise.id, getExerciseQuestionType(exercise));
    });
    return questionTypes;
  }, [exercises, submissionQuestionTypes]);
  const answeredSubmissions = useMemo(
    () => submissions.filter(submission => {
      const questionType = exerciseTypeById.get(submission.exercise_id);
      return questionType === 'single' || questionType === 'multiple'
        ? submission.is_correct !== null
        : submission.is_correct !== null && submission.ai_score !== null;
    }),
    [exerciseTypeById, submissions],
  );
  const completedCount = submissions.length;
  const avgScore = answeredSubmissions.length > 0
    ? Math.round(answeredSubmissions.reduce((sum, submission) => {
      const questionType = exerciseTypeById.get(submission.exercise_id);
      const score = questionType === 'single' || questionType === 'multiple'
        ? (submission.is_correct ? 100 : 0)
        : Number(submission.ai_score ?? 0);
      return sum + score;
    }, 0) / answeredSubmissions.length)
    : 0;
  const correctRate = answeredSubmissions.length > 0
    ? Math.round((answeredSubmissions.filter(submission => submission.is_correct).length / answeredSubmissions.length) * 100)
    : 0;
  const totalDurationMinutes = Math.round(submissions.reduce((sum, submission) => sum + (submission.time_spent || 0), 0) / 60);
  const radarData = useMemo(() => {
    if (mastery.length > 0) {
      return mastery.slice(0, 6).map(item => ({
        subject: knowledgePointTitles[item.knowledge_point_id] ?? '知识点',
        A: Math.round(item.mastery_score),
        fullMark: 100,
      }));
    }
    if (answeredSubmissions.length > 0) {
      return [{ subject: '练习正确率', A: correctRate, fullMark: 100 }];
    }
    return [];
  }, [answeredSubmissions.length, correctRate, knowledgePointTitles, mastery]);
  const weaknessStats = useMemo(() => mastery
    .slice()
    .sort((a, b) => a.mastery_score - b.mastery_score)
    .slice(0, 5)
    .map(item => ({
      name: knowledgePointTitles[item.knowledge_point_id] ?? '未命名知识点',
      score: Math.round(item.mastery_score),
      threshold: 75,
    })), [knowledgePointTitles, mastery]);
  const scoreHistory = useMemo(() => {
    const points = new Map<string, { total: number; count: number }>();
    answeredSubmissions.forEach(submission => {
      const date = submission.created_at.slice(0, 10);
      const questionType = exerciseTypeById.get(submission.exercise_id);
      const score = questionType === 'subjective' ? Number(submission.ai_score ?? 0) : submission.is_correct ? 100 : 0;
      const current = points.get(date) ?? { total: 0, count: 0 };
      points.set(date, { total: current.total + score, count: current.count + 1 });
    });
    evaluations.forEach(evaluation => {
      const date = evaluation.created_at.slice(0, 10);
      if (points.has(date)) return;
      const score = evaluation.score ?? evaluation.knowledge_score;
      if (typeof score === 'number') points.set(date, { total: score, count: 1 });
    });
    return [...points.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([date, point]) => ({ date: `${date.slice(5, 7)}-${date.slice(8, 10)}`, score: Math.round(point.total / point.count) }));
  }, [answeredSubmissions, evaluations, exerciseTypeById]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            学习效果评估
          </h1>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/wrong-book">
              <BookMarked className="w-3.5 h-3.5" />
              错题本
            </Link>
          </Button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Target, label: '练习次数', value: completedCount, color: 'text-primary' },
            { icon: TrendingUp, label: '平均得分', value: avgScore, color: 'text-secondary' },
            {
              icon: Zap, label: '正确率',
              value: `${correctRate}%`,
              color: 'text-green-500',
            },
            {
              icon: Clock, label: '总时长',
              value: `${totalDurationMinutes}分`,
              color: 'text-sky-500',
            },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                    <span className="text-xs">{s.label}</span>
                  </div>
                  <p className="text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* 标签切换 */}
        <div className="flex gap-0 border-b border-border overflow-x-auto">
          {[
            { key: 'practice' as const, label: '练习题目', icon: BookOpen },
            { key: 'oral' as const,     label: '口述评估', icon: Mic },
            { key: 'essay' as const,    label: '综合论述', icon: PenTool },
            { key: 'overview' as const, label: '能力雷达', icon: Brain },
            { key: 'history' as const,  label: '分数趋势', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />能力雷达图
                </CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length === 0 ? (
                  <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">暂无已评估的知识点或答题数据</div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="能力得分" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} strokeWidth={2} />
                      <Legend wrapperStyle={{ paddingTop: 8 }} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />薄弱知识点
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weaknessStats.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">暂无知识点掌握度数据，完成带知识点的练习后将显示薄弱项</p>
                ) : weaknessStats.map(item => (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className={`text-sm font-medium ${item.score < item.threshold ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{item.score}分</span>
                    </div>
                    <Progress value={item.score} className="h-2" />
                    {item.score < item.threshold && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="w-3 h-3" />低于目标{item.threshold}分，建议加强练习
                      </div>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                  <Link to="/resources?type=exercise"><Target className="w-3.5 h-3.5 mr-1.5" />针对性练习</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'history' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />分数变化趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {scoreHistory.length === 0 ? (
                <div className="h-80 flex items-center justify-center text-sm text-muted-foreground">暂无已完成评分的答题或评估记录</div>
              ) : (
                <div className="w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={scoreHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                      <Legend wrapperStyle={{ paddingTop: 8 }} />
                      <Line type="monotone" dataKey="score" name="我的得分" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'practice' && (
          <div className="space-y-4">
            {/* 来源筛选：资源中心练习题 */}
            {exerciseSources.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Library className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">来源：</span>
                <button type="button"
                  onClick={() => setSelectedSource('all')}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${selectedSource === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                  全部练习
                </button>
                {exerciseSources.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => setSelectedSource(s.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors max-w-[180px] truncate ${selectedSource === s.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            {/* 空状态 */}
            {exercises.filter(e => selectedSource === 'all' || e.source_resource_id === selectedSource).length === 0 && !loading && (
              <div className="text-center py-14 text-muted-foreground">
                <BookOpen className="w-14 h-14 mx-auto mb-3 opacity-15" />
                <p className="text-sm font-medium">暂无练习题目</p>
                <p className="text-xs mt-1 mb-4">前往资源中心生成「练习题」类型的资源，题目将自动同步到这里</p>
                <Button size="sm" variant="outline" asChild>
                  <a href="/resources/generate">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />前往生成练习题
                  </a>
                </Button>
              </div>
            )}

            {exercises
              .filter(e => selectedSource === 'all' || e.source_resource_id === selectedSource)
              .map((ex, idx) => {
                const state = exState[ex.id] ?? initialExerciseState();
                const questionType = getExerciseQuestionType(ex);
                const isSubmitted = state.submitted;
                const selectedAnswers = Array.isArray(state.selectedAnswer) ? state.selectedAnswer : [];
                let correctAnswerLabel = ex.answer;
                if (questionType === 'multiple') {
                  try {
                    const parsed: unknown = JSON.parse(ex.answer);
                    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
                      correctAnswerLabel = parsed.join('、');
                    }
                  } catch {
                    // 保留旧数据中的原始答案文本。
                  }
                }
                return (
                  <motion.div key={ex.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                    <Card className="overflow-hidden">
                      <CardContent className="p-4">
                        {ex.source_title && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <Library className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[11px] text-muted-foreground">{ex.source_title}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <div className="flex gap-1.5 shrink-0 mt-0.5 flex-wrap">
                            <Badge variant={ex.difficulty === 'hard' ? 'destructive' : ex.difficulty === 'medium' ? 'secondary' : 'default'}>
                              {ex.difficulty === 'easy' ? '简单' : ex.difficulty === 'medium' ? '中等' : '困难'}
                            </Badge>
                            <Badge variant="outline">{questionTypeLabels[questionType]}</Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium mb-3 text-pretty">{ex.question}</p>

                            {questionType === 'single' && (
                              <RadioGroup
                                value={typeof state.selectedAnswer === 'string' ? state.selectedAnswer : ''}
                                onValueChange={value => updateAnswer(ex.id, value)}
                                disabled={isSubmitted}
                                aria-label={`${ex.question}的答案`}
                                className="mb-4"
                              >
                                {ex.options.map((option, index) => (
                                  <label key={option} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm cursor-pointer has-[:disabled]:cursor-default">
                                    <RadioGroupItem value={option} disabled={isSubmitted} />
                                    <span className="font-medium text-muted-foreground">{String.fromCharCode(65 + index)}.</span>
                                    <span>{option}</span>
                                  </label>
                                ))}
                              </RadioGroup>
                            )}

                            {questionType === 'multiple' && (
                              <div className="space-y-2 mb-4" role="group" aria-label={`${ex.question}的答案，可多选`}>
                                {ex.options.map((option, index) => {
                                  const checked = selectedAnswers.includes(option);
                                  return (
                                    <label key={option} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm cursor-pointer has-[:disabled]:cursor-default">
                                      <Checkbox
                                        checked={checked}
                                        disabled={isSubmitted}
                                        onCheckedChange={nextChecked => updateAnswer(ex.id, nextChecked
                                          ? [...selectedAnswers, option]
                                          : selectedAnswers.filter(answer => answer !== option))}
                                      />
                                      <span className="font-medium text-muted-foreground">{String.fromCharCode(65 + index)}.</span>
                                      <span>{option}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {questionType === 'subjective' && (
                              <Textarea
                                value={typeof state.selectedAnswer === 'string' ? state.selectedAnswer : ''}
                                onChange={event => updateAnswer(ex.id, event.target.value)}
                                disabled={isSubmitted}
                                rows={5}
                                className="mb-4 resize-y"
                                placeholder="请输入你的答案…"
                                aria-label={`${ex.question}的答案`}
                              />
                            )}

                            {isSubmitted && state.localResult && (
                              <div aria-live="polite" className={`mb-3 rounded-lg border p-3 ${state.localResult.is_correct ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20' : 'border-destructive/30 bg-destructive/5'}`}>
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                  {state.localResult.is_correct ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
                                  {state.localResult.is_correct ? '本地判分：回答正确 · 100分' : '本地判分：回答有误 · 0分'}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground text-pretty">标准答案：{correctAnswerLabel}</p>
                                {ex.explanation && <p className="mt-1 text-xs text-muted-foreground text-pretty">解析：{ex.explanation}</p>}
                              </div>
                            )}

                            {isSubmitted && state.aiStatus === 'pending' && (
                              <div aria-live="polite" className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
                                <p>{state.submissionStatus === 'saving'
                                  ? questionType === 'subjective'
                                    ? '答案已锁定，正在保存；保存后开始 AI 评估，可继续下一题。'
                                    : '答题结果已确定，保存后开始生成 AI 个性化建议。'
                                  : state.aiError
                                    ? '上次 AI 评估未完成，可重新发起。'
                                    : questionType === 'subjective'
                                      ? '已提交，AI 评估中，可继续下一题。'
                                      : 'AI 个性化建议生成中…'}</p>
                                {state.aiError && state.submissionId && (
                                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => retryAiEvaluation(ex)}>
                                    <RefreshCw className="mr-1.5 w-3.5 h-3.5" />重新发起 AI 评估
                                  </Button>
                                )}
                              </div>
                            )}
                            {isSubmitted && state.submissionStatus === 'saving' && (
                              <div aria-live="polite" className="mb-3 text-xs text-muted-foreground">正在保存答题记录…</div>
                            )}
                            {isSubmitted && state.submissionStatus === 'failed' && (
                              <div aria-live="polite" className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                                <p>答题记录未保存{state.submissionError ? `：${state.submissionError}` : ''}</p>
                                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => retrySubmission(ex)}>
                                  <RefreshCw className="mr-1.5 w-3.5 h-3.5" />重试保存
                                </Button>
                              </div>
                            )}

                            {isSubmitted && state.aiStatus === 'completed' && state.aiResult && (
                              <div aria-live="polite" className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                                <p className="mb-1.5 text-sm font-semibold">AI 个性化建议</p>
                                {questionType === 'subjective' && (
                                  <p className="mb-1 text-sm">AI 评分：{state.aiResult.is_correct ? '回答正确' : '仍需改进'} · {state.aiResult.score}分</p>
                                )}
                                {state.aiResult.analysis && <p className="text-xs text-muted-foreground text-pretty">{state.aiResult.analysis}</p>}
                                {state.aiResult.feedback && <p className="mt-1 text-xs text-primary text-pretty">{state.aiResult.feedback}</p>}
                                {state.aiResult.suggestions && <p className="mt-1 text-xs text-muted-foreground text-pretty">建议：{state.aiResult.suggestions}</p>}
                              </div>
                            )}
                            {isSubmitted && state.aiStatus === 'failed' && (
                              <div aria-live="polite" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                <p>解析暂不可用{state.aiError ? `：${state.aiError}` : ''}</p>
                                {state.submissionId && (
                                  <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => retryAiEvaluation(ex)}>
                                    <RefreshCw className="mr-1.5 w-3.5 h-3.5" />重试 AI 解析
                                  </Button>
                                )}
                              </div>
                            )}

                            {!isSubmitted ? (
                              <Button size="sm" onClick={() => handleSubmitAnswer(ex)} className="gap-1.5">
                                <ArrowRight className="w-3.5 h-3.5" />提交答案
                              </Button>
                            ) : state.localResult && !state.localResult.is_correct ? (
                              <Button size="sm" variant="ghost" asChild className="text-xs h-7 gap-1 text-destructive">
                                <Link to="/wrong-book"><BookMarked className="w-3 h-3" />查看错题本</Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
          </div>
        )}

        {/* ── 口述评估 Tab ──────────────────────────────────────── */}
        {activeTab === 'oral' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mic className="w-4 h-4 text-violet-500" />口述评估
                  <Badge variant="secondary" className="text-xs ml-1">模拟口头表达能力</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">评估主题</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="输入要口述的主题，如：解释递归算法的原理..."
                    value={oralTopic}
                    onChange={e => setOralTopic(e.target.value)}
                  />
                </div>

                <div className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-6 text-center space-y-3">
                  <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-colors ${oralRecording ? 'bg-destructive/10 animate-pulse' : 'bg-muted'}`}>
                    {oralRecording ? <MicOff className="w-8 h-8 text-destructive" /> : <Mic className="w-8 h-8 text-muted-foreground" />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {oralRecording ? '录音中，点击停止...' : '点击开始录音，或直接在下方输入口述内容'}
                  </p>
                  <Button
                    variant={oralRecording ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setOralRecording(v => !v);
                      if (oralRecording) toast.info('录音已停止（演示模式，请手动输入内容）');
                    }}
                    className="gap-1.5"
                  >
                    {oralRecording ? <><Square className="w-3.5 h-3.5" />停止录音</> : <><Mic className="w-3.5 h-3.5" />开始录音</>}
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    口述内容（可直接输入）
                  </label>
                  <Textarea
                    placeholder="在此输入或粘贴你的口述内容，AI将对逻辑性、完整性、表达准确度进行评估..."
                    rows={5}
                    value={oralText}
                    onChange={e => setOralText(e.target.value)}
                    className="resize-none"
                  />
                </div>

                <Button
                  onClick={async () => {
                    if (!oralTopic.trim()) { toast.error('请填写评估主题'); return; }
                    if (!oralText.trim()) { toast.error('请输入口述内容'); return; }
                    setOralLoading(true);
                    setOralError(null);
                    setOralResult(null);
                    try {
                      const data = await textAIService.evaluateAnswer({
                        question: `请评估以下关于「${oralTopic}」的口述表达：\n\n${oralText}`,
                        questionType: 'oral',
                        correctAnswer: '',
                        userAnswer: oralText,
                      });
                      if (typeof data?.score !== 'number') throw new Error('AI 未返回有效评分');
                      setOralResult({
                        score: data.score,
                        feedback: data.feedback ?? 'AI 已完成评分。',
                        strengths: data.strengths ?? [],
                        improvements: data.improvements ?? [],
                      });
                      toast.success('口述评估完成！');
                    } catch (error) {
                      const message = error instanceof Error ? error.message : '口述评估暂不可用';
                      setOralError(message);
                      toast.error(`口述评估失败：${message}`);
                    } finally {
                      setOralLoading(false);
                    }
                  }}
                  disabled={oralLoading || !oralTopic.trim() || !oralText.trim()}
                  className="w-full gap-1.5"
                >
                  {oralLoading ? <><Loader2 className="w-4 h-4 animate-spin" />AI评估中...</> : <><Brain className="w-4 h-4" />提交评估</>}
                </Button>

                {oralError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">口述评估失败：{oralError}</div>
                )}

                <AnimatePresence>
                  {oralResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="text-xl font-bold text-primary-foreground">{oralResult.score}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">综合评分</p>
                          <Progress value={oralResult.score} className="h-1.5 w-32 mt-1" />
                          <p className="text-xs text-muted-foreground mt-1 text-pretty">{oralResult.feedback}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1"><Star className="w-3 h-3" />优点</p>
                          {oralResult.strengths.map((s, i) => <p key={i} className="text-xs text-emerald-700 dark:text-emerald-400 text-pretty">✓ {s}</p>)}
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1"><Lightbulb className="w-3 h-3" />改进建议</p>
                          {oralResult.improvements.map((s, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400 text-pretty">→ {s}</p>)}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── 综合论述 Tab ──────────────────────────────────────── */}
        {activeTab === 'essay' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-amber-500" />综合论述评估
                  <Badge variant="secondary" className="text-xs ml-1">书面表达与论证能力</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">论述题目</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="输入论述题目，如：分析面向对象编程的核心思想及其优势..."
                    value={essayTopic}
                    onChange={e => setEssayTopic(e.target.value)}
                  />
                </div>

                {/* 评分维度说明 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['内容深度', '论证逻辑', '语言表达', '知识准确'].map((dim, i) => (
                    <div key={dim} className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                      <div className={`w-6 h-6 rounded-full mx-auto mb-1 flex items-center justify-center text-xs font-bold text-white ${['bg-violet-500','bg-sky-500','bg-emerald-500','bg-amber-500'][i]}`}>{['📝','🔗','💬','✅'][i]}</div>
                      <p className="text-[11px] text-muted-foreground">{dim}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground" />论述内容</span>
                    <span className="text-[11px] text-muted-foreground font-normal">{essayContent.length} 字</span>
                  </label>
                  <Textarea
                    placeholder={`围绕题目展开论述...\n\n建议结构：\n1. 概念界定（说明核心概念）\n2. 主要论点（2-3个核心观点）\n3. 论据支撑（举例或原理说明）\n4. 总结提升`}
                    rows={10}
                    value={essayContent}
                    onChange={e => setEssayContent(e.target.value)}
                    className="resize-none font-mono text-sm leading-relaxed"
                  />
                </div>

                <Button
                  onClick={async () => {
                    if (!essayTopic.trim()) { toast.error('请填写论述题目'); return; }
                    if (essayContent.trim().length < 50) { toast.error('论述内容至少50字'); return; }
                    setEssayLoading(true);
                    setEssayError(null);
                    setEssayResult(null);
                    try {
                      const data = await textAIService.evaluateAnswer({
                        question: `请对以下关于「${essayTopic}」的综合论述进行多维度评估：\n\n${essayContent}`,
                        questionType: 'essay',
                        correctAnswer: '',
                        userAnswer: essayContent,
                      });
                      if (typeof data?.score !== 'number') throw new Error('AI 未返回有效评分');
                      setEssayResult({
                        score: data.score,
                        feedback: data.feedback ?? 'AI 已完成评分。',
                        dimensions: data.dimensions ?? [],
                      });
                      toast.success('论述评估完成！');
                    } catch (error) {
                      const message = error instanceof Error ? error.message : '论述评估暂不可用';
                      setEssayError(message);
                      toast.error(`论述评估失败：${message}`);
                    } finally {
                      setEssayLoading(false);
                    }
                  }}
                  disabled={essayLoading || !essayTopic.trim() || essayContent.trim().length < 50}
                  className="w-full gap-1.5"
                >
                  {essayLoading ? <><Loader2 className="w-4 h-4 animate-spin" />AI评估中...</> : <><Brain className="w-4 h-4" />提交评估</>}
                </Button>

                {essayError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">论述评估失败：{essayError}</div>
                )}

                <AnimatePresence>
                  {essayResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                        <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                          <span className="text-xl font-bold text-white">{essayResult.score}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">综合得分</p>
                          <Progress value={essayResult.score} className="h-1.5 mt-1" />
                          <p className="text-xs text-muted-foreground mt-1 text-pretty">{essayResult.feedback}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {essayResult.dimensions.map(dim => (
                          <div key={dim.name} className="p-3 rounded-xl bg-muted/40 border border-border">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-xs font-medium">{dim.name}</span>
                              <span className="text-sm font-bold text-primary">{dim.score}</span>
                            </div>
                            <Progress value={dim.score} className="h-1" />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
