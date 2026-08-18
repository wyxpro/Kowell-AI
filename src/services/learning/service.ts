import { supabase } from '@/db/supabase';
import type {
  Evaluation,
  JsonObject,
  KnowledgeMastery,
  LearningEvent,
  LearningEventReferences,
  LearningEventStatus,
  LearningEventType,
  PortraitRevision,
  StudyReport,
} from '@/types/types';

export interface RecordLearningEventInput {
  courseId?: string | null;
  eventType: LearningEventType;
  knowledgePointId?: string | null;
  resourceId?: string | null;
  exerciseId?: string | null;
  submissionId?: string | null;
  payload?: JsonObject;
  idempotencyKey?: string;
  processingStatus?: LearningEventStatus;
  /** @deprecated Use processingStatus. */
  status?: LearningEventStatus;
}

export interface ResourceFeedbackInput extends RecordLearningEventInput {
  resourceId: string;
  payload?: JsonObject;
}

export interface ExerciseSubmittedInput extends RecordLearningEventInput {
  exerciseId: string;
  submissionId?: string | null;
  payload?: JsonObject;
}

export interface LearningAdaptResponse {
  accepted?: boolean;
  learning_event_id?: string;
  status?: string;
  message?: string;
}

export interface LearningReportData {
  report: StudyReport | null;
  evaluations: Evaluation[];
  mastery: KnowledgeMastery[];
  portraitRevisions: PortraitRevision[];
}

export class LearningServiceError extends Error {
  readonly code: 'UNAUTHENTICATED' | 'INVALID_INPUT' | 'WRITE_FAILED' | 'READ_FAILED' | 'ADAPT_FAILED';
  readonly causeValue?: unknown;

  constructor(
    code: LearningServiceError['code'],
    message: string,
    causeValue?: unknown,
  ) {
    super(message);
    this.name = 'LearningServiceError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

interface EventInsertRow {
  user_id: string;
  course_id: string | null;
  event_type: LearningEventType;
  knowledge_point_id: string | null;
  resource_id: string | null;
  exercise_id: string | null;
  submission_id: string | null;
  payload: JsonObject;
  idempotency_key: string;
  processing_status: 'pending';
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

async function currentUser(): Promise<{ id: string; accessToken: string }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new LearningServiceError('UNAUTHENTICATED', error.message, error);
  if (!data.session?.user) throw new LearningServiceError('UNAUTHENTICATED', '需要登录后才能记录学习行为');
  return { id: data.session.user.id, accessToken: data.session.access_token };
}

function eventTable() {
  return supabase.from('learning_events' as never) as unknown as {
    upsert: (values: EventInsertRow, options: { onConflict: string; ignoreDuplicates: boolean }) => {
      select: (columns: string) => { maybeSingle: () => Promise<{ data: LearningEvent | null; error: unknown }> };
    };
  };
}

export async function recordLearningEvent(input: RecordLearningEventInput): Promise<LearningEvent> {
  if (!input.eventType) throw new LearningServiceError('INVALID_INPUT', 'eventType 不能为空');
  const user = await currentUser();
  const requestedStatus = input.processingStatus ?? input.status;
  if (requestedStatus && requestedStatus !== 'pending') {
    throw new LearningServiceError('INVALID_INPUT', '客户端只能创建 pending 状态的学习事件');
  }
  const references: LearningEventReferences = {
    ...(input.resourceId ? { resource_id: input.resourceId } : {}),
    ...(input.exerciseId ? { exercise_id: input.exerciseId } : {}),
    ...(input.submissionId ? { submission_id: input.submissionId } : {}),
  };
  const insert: EventInsertRow = {
    user_id: user.id,
    course_id: input.courseId ?? null,
    event_type: input.eventType,
    knowledge_point_id: input.knowledgePointId ?? null,
    resource_id: input.resourceId ?? null,
    exercise_id: input.exerciseId ?? null,
    submission_id: input.submissionId ?? null,
    payload: {
      ...(input.payload ?? {}),
      ...(Object.keys(references).length ? { references } : {}),
    },
    idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
    processing_status: 'pending',
  };
  const { data, error } = await eventTable().upsert(insert, { onConflict: 'user_id,idempotency_key', ignoreDuplicates: false }).select('*').maybeSingle();
  if (error) throw new LearningServiceError('WRITE_FAILED', errorMessage(error, '记录学习事件失败'), error);
  if (!data) throw new LearningServiceError('WRITE_FAILED', '记录学习事件未返回数据');
  return data;
}

export async function recordResourceViewed(input: Omit<RecordLearningEventInput, 'eventType'> & { resourceId: string }): Promise<LearningEvent> {
  return recordLearningEvent({ ...input, eventType: 'resource_viewed' });
}

export async function recordResourceCompleted(input: Omit<RecordLearningEventInput, 'eventType'> & { resourceId: string }): Promise<LearningEvent> {
  return recordLearningEvent({ ...input, eventType: 'resource_completed' });
}

export async function recordResourceFeedback(input: ResourceFeedbackInput): Promise<LearningEvent> {
  return recordLearningEvent({ ...input, eventType: 'resource_feedback' });
}

export async function recordExerciseSubmitted(input: ExerciseSubmittedInput): Promise<LearningEvent> {
  return recordLearningEvent({ ...input, eventType: 'exercise_submitted' });
}

export async function recordWeaknessTrainingCompleted(
  input: Omit<RecordLearningEventInput, 'eventType'>,
): Promise<LearningEvent> {
  return recordLearningEvent({ ...input, eventType: 'weakness_training_completed' });
}

export async function triggerLearningAdapt(learningEventId: string): Promise<LearningAdaptResponse> {
  if (!learningEventId) throw new LearningServiceError('INVALID_INPUT', 'learningEventId 不能为空');
  const user = await currentUser();
  const { data, error } = await supabase.functions.invoke<LearningAdaptResponse>('learning-adapt', {
    method: 'POST',
    body: { learning_event_id: learningEventId },
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  if (error) {
    throw new LearningServiceError('ADAPT_FAILED', errorMessage(error, '触发学习适配失败'), error);
  }
  if (!data) throw new LearningServiceError('ADAPT_FAILED', '学习适配函数未返回结果');
  return data;
}

export async function getMastery(courseId?: string): Promise<KnowledgeMastery[]> {
  const user = await currentUser();
  interface MasteryQuery {
    eq: (column: string, value: string) => MasteryQuery;
    order: (column: string, options: { ascending: boolean }) => Promise<{ data: KnowledgeMastery[] | null; error: unknown }>;
  }
  const query = supabase.from('user_knowledge_mastery' as never) as unknown as {
    select: (columns: string) => MasteryQuery;
  };
  let builder = query.select('*').eq('user_id', user.id);
  if (courseId) builder = builder.eq('course_id', courseId);
  const { data, error } = await builder.order('updated_at', { ascending: false });
  if (error) throw new LearningServiceError('READ_FAILED', errorMessage(error, '读取知识点掌握度失败'), error);
  return data ?? [];
}

export async function getPortraitRevisions(limit = 20): Promise<PortraitRevision[]> {
  const user = await currentUser();
  const query = supabase.from('learning_portrait_revisions' as never) as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (count: number) => Promise<{ data: PortraitRevision[] | null; error: unknown }>;
        };
      };
    };
  };
  const { data, error } = await query.select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit);
  if (error) throw new LearningServiceError('READ_FAILED', errorMessage(error, '读取画像修订失败'), error);
  return data ?? [];
}

export async function getLearningReportData(options: {
  periodStart?: string;
  periodEnd?: string;
  courseId?: string;
} = {}): Promise<LearningReportData> {
  if (options.periodStart && Number.isNaN(Date.parse(options.periodStart))) {
    throw new LearningServiceError('INVALID_INPUT', 'periodStart 必须是有效时间');
  }
  if (options.periodEnd && Number.isNaN(Date.parse(options.periodEnd))) {
    throw new LearningServiceError('INVALID_INPUT', 'periodEnd 必须是有效时间');
  }
  if (options.periodStart && options.periodEnd && Date.parse(options.periodStart) > Date.parse(options.periodEnd)) {
    throw new LearningServiceError('INVALID_INPUT', 'periodStart 不能晚于 periodEnd');
  }
  const user = await currentUser();
  interface ReportQuery {
    eq: (column: string, value: string) => ReportQuery;
    gte: (column: string, value: string) => ReportQuery;
    lte: (column: string, value: string) => ReportQuery;
    order: (column: string, options: { ascending: boolean }) => {
      limit: (count: number) => Promise<{ data: StudyReport[] | null; error: unknown }>;
    };
  }
  interface EvaluationQuery {
    eq: (column: string, value: string) => EvaluationQuery;
    gte: (column: string, value: string) => EvaluationQuery;
    lte: (column: string, value: string) => EvaluationQuery;
    order: (column: string, options: { ascending: boolean }) => Promise<{ data: Evaluation[] | null; error: unknown }>;
  }
  const reportQuery = supabase.from('study_reports' as never) as unknown as {
    select: (columns: string) => ReportQuery;
  };
  const evaluationQuery = supabase.from('evaluations' as never) as unknown as {
    select: (columns: string) => EvaluationQuery;
  };

  let reportBuilder = reportQuery.select('*').eq('user_id', user.id);
  let evaluationBuilder = evaluationQuery.select('*').eq('user_id', user.id);
  if (options.periodStart) {
    reportBuilder = reportBuilder.gte('period_end', options.periodStart);
    evaluationBuilder = evaluationBuilder.gte('created_at', options.periodStart);
  }
  if (options.periodEnd) {
    reportBuilder = reportBuilder.lte('period_start', options.periodEnd);
    evaluationBuilder = evaluationBuilder.lte('created_at', options.periodEnd);
  }

  const [reportResult, evaluationResult, mastery, portraitRevisions] = await Promise.all([
    reportBuilder.order('period_end', { ascending: false }).limit(1),
    evaluationBuilder.order('created_at', { ascending: false }),
    getMastery(options.courseId),
    getPortraitRevisions(),
  ]);
  const error = reportResult.error ?? evaluationResult.error;
  if (error) throw new LearningServiceError('READ_FAILED', errorMessage(error, '读取学习报告数据失败'), error);
  return {
    report: reportResult.data?.[0] ?? null,
    evaluations: evaluationResult.data ?? [],
    mastery,
    portraitRevisions,
  };
}
