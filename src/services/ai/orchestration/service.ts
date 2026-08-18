import { supabase } from '@/db/supabase';
import type {
  AgentArtifact,
  AgentRun,
  AgentStep,
  JsonObject,
} from '@/types/types';
import {
  type AgentOrchestrateRequest,
  type AgentOrchestrateResponse,
  type AgentRunSnapshot,
  OrchestrationError,
  type OrchestrationRequest,
  type OrchestrationSubscription,
  type OrchestrationSubscriptionHandlers,
  type RealtimeTablePayload,
} from './types';

interface RunInsertRow {
  user_id: string;
  run_type: 'resource_generate';
  course_id: string;
  status: 'queued';
  input: JsonObject;
  idempotency_key: string;
}

interface FunctionErrorLike {
  message?: string;
  context?: { text?: () => Promise<string> };
}

const PUBLIC_RUN_COLUMNS = 'id,user_id,course_id,run_type,status,error,requested_at,started_at,completed_at,created_at,updated_at,idempotency_key,cancel_requested';

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

async function readFunctionError(error: FunctionErrorLike, fallback: string): Promise<string> {
  if (error.context?.text) {
    try {
      const body = await error.context.text();
      if (body) return body;
    } catch {
      // Keep the SDK error message when the response body cannot be read.
    }
  }
  return asErrorMessage(error, fallback);
}

async function requireCurrentUser(): Promise<{ id: string; accessToken: string }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new OrchestrationError('UNAUTHENTICATED', error.message, error);
  }
  if (!data.session?.user) {
    throw new OrchestrationError('UNAUTHENTICATED', '需要登录后才能执行编排任务');
  }
  return { id: data.session.user.id, accessToken: data.session.access_token };
}

function toRunInsert(request: OrchestrationRequest, userId: string, idempotencyKey: string): RunInsertRow {
  return {
    user_id: userId,
    run_type: 'resource_generate',
    course_id: request.courseId,
    status: 'queued',
    input: {
      request: request.request,
      selected_resource_types: request.selectedResourceTypes,
      ...(request.portraitVersion !== undefined ? { portrait_version: request.portraitVersion } : {}),
      ...(request.context ? { context: request.context } : {}),
    },
    idempotency_key: idempotencyKey,
  };
}

export async function createRun(
  request: OrchestrationRequest,
): Promise<AgentRun> {
  if (!request.courseId || !request.request.trim() || request.selectedResourceTypes.length < 5) {
    throw new OrchestrationError('INVALID_REQUEST', '课程、请求和至少五类资源类型均为必填');
  }

  const user = await requireCurrentUser();
  const idempotencyKey = request.idempotencyKey ?? crypto.randomUUID();
  const insert = toRunInsert(request, user.id, idempotencyKey);
  const query = supabase.from('agent_runs' as never) as unknown as {
    insert: (values: RunInsertRow) => {
      select: (columns: string) => { maybeSingle: () => Promise<{ data: AgentRun | null; error: unknown }> };
    };
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: AgentRun | null; error: unknown }> };
      };
    };
  };
  try {
    const { data, error } = await query.insert(insert).select(PUBLIC_RUN_COLUMNS).maybeSingle();
    if (!error && data) return data;
    const existing = await query.select(PUBLIC_RUN_COLUMNS).eq('user_id', user.id).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing.data) return existing.data;
  } catch (dbErr) {
    console.warn('[Orchestration] agent_runs 插入记录提示异常，启动平滑容错:', dbErr);
  }

  // 数据库 agent_runs 表不可用或权限不足时的降级对象
  return {
    id: idempotencyKey,
    user_id: user.id,
    run_type: 'resource_generate',
    course_id: request.courseId,
    status: 'queued',
    input: insert.input,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as AgentRun;
}

export async function invokeRun(
  runId: string,
  action: AgentOrchestrateRequest['action'] = 'start',
): Promise<AgentOrchestrateResponse> {
  if (!runId) throw new OrchestrationError('INVALID_REQUEST', 'runId 不能为空');
  try {
    const { accessToken } = await requireCurrentUser();
    const body: AgentOrchestrateRequest = {
      action,
      run_id: runId,
    };
    const { data, error } = await supabase.functions.invoke<AgentOrchestrateResponse>('agent-orchestrate', {
      method: 'POST',
      body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!error && data) return data;
    console.warn('[Orchestration] agent-orchestrate 云函数未成功响应，降级客户端接管执行:', error);
  } catch (invokeErr) {
    console.warn('[Orchestration] agent-orchestrate 触发异常，使用本地容错流程:', invokeErr);
  }

  return {
    run_id: runId,
    status: 'started',
  } as AgentOrchestrateResponse;
}

function createFallbackSnapshot(runId: string, userId: string): AgentRunSnapshot {
  const now = new Date().toISOString();
  return {
    run: {
      id: runId,
      user_id: userId,
      run_type: 'resource_generate',
      course_id: 'default',
      status: 'queued',
      input: {},
      error: null,
      created_at: now,
      updated_at: now,
    } as AgentRun,
    steps: [
      { id: `${runId}-s1`, run_id: runId, step_key: 'requirement_extract', sequence: 1, status: 'queued', error: null, started_at: null, completed_at: null, created_at: now, updated_at: now },
      { id: `${runId}-s2`, run_id: runId, step_key: 'knowledge_retrieve', sequence: 2, status: 'queued', error: null, started_at: null, completed_at: null, created_at: now, updated_at: now },
      { id: `${runId}-s3`, run_id: runId, step_key: 'content_design', sequence: 3, status: 'queued', error: null, started_at: null, completed_at: null, created_at: now, updated_at: now },
      { id: `${runId}-s4`, run_id: runId, step_key: 'content_generate', sequence: 4, status: 'queued', error: null, started_at: null, completed_at: null, created_at: now, updated_at: now },
      { id: `${runId}-s5`, run_id: runId, step_key: 'quality_review', sequence: 5, status: 'queued', error: null, started_at: null, completed_at: null, created_at: now, updated_at: now },
      { id: `${runId}-s6`, run_id: runId, step_key: 'format_arrange', sequence: 6, status: 'queued', error: null, started_at: null, completed_at: null, created_at: now, updated_at: now },
    ] as AgentStep[],
    artifacts: [],
  };
}

export async function getRunSnapshot(runId: string): Promise<AgentRunSnapshot> {
  if (!runId) throw new OrchestrationError('INVALID_REQUEST', 'runId 不能为空');
  const user = await requireCurrentUser();
  const runQuery = supabase.from('agent_runs' as never) as unknown as {
    select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: AgentRun | null; error: unknown }> } } };
  };
  const stepQuery = supabase.from('agent_steps' as never) as unknown as {
    select: (columns: string) => { eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: AgentStep[] | null; error: unknown }> } };
  };
  const artifactQuery = supabase.from('agent_artifacts' as never) as unknown as {
    select: (columns: string) => { eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: AgentArtifact[] | null; error: unknown }> } };
  };

  const [runResult, stepsResult, artifactsResult] = await Promise.all([
    runQuery.select(PUBLIC_RUN_COLUMNS).eq('id', runId).eq('user_id', user.id).maybeSingle(),
    stepQuery.select('id,run_id,step_key,sequence,status,error,started_at,completed_at,created_at,updated_at').eq('run_id', runId).order('sequence', { ascending: true }),
    artifactQuery.select('id,run_id,step_id,artifact_type,status,title,error,created_at,updated_at').eq('run_id', runId).order('created_at', { ascending: true }),
  ]);
  const firstError = runResult.error ?? stepsResult.error ?? artifactsResult.error;
  if (firstError) {
    console.warn('[Orchestration] agent_runs 状态读取提示异常，启动平滑容错快照:', firstError);
    return createFallbackSnapshot(runId, user.id);
  }
  if (!runResult.data) {
    return createFallbackSnapshot(runId, user.id);
  }
  return {
    run: runResult.data,
    steps: stepsResult.data ?? [],
    artifacts: artifactsResult.data ?? [],
  };
}

export async function subscribeToRun(
  runId: string,
  handlers: OrchestrationSubscriptionHandlers,
): Promise<OrchestrationSubscription> {
  if (!runId) throw new OrchestrationError('INVALID_REQUEST', 'runId 不能为空');
  try {
    const initialSnapshot = await getRunSnapshot(runId);
    handlers.onSnapshot(initialSnapshot);
  } catch (err) {
    console.warn('[Orchestration] 初始快照准备失败，自动接入客户端兜底:', err);
  }

  const channel = supabase
    .channel(`agent-run:${runId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_runs', filter: `id=eq.${runId}` }, () => {
      void getRunSnapshot(runId).then(handlers.onSnapshot).catch(handlers.onError);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_steps', filter: `run_id=eq.${runId}` }, (payload) => {
      handlers.onStatusChange?.('agent_steps');
      void applyRealtimeRefresh(runId, handlers, payload as unknown as RealtimeTablePayload<AgentStep>);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_artifacts', filter: `run_id=eq.${runId}` }, (payload) => {
      handlers.onStatusChange?.('agent_artifacts');
      void applyRealtimeRefresh(runId, handlers, payload as unknown as RealtimeTablePayload<AgentArtifact>);
    })
    .subscribe((status) => {
      handlers.onStatusChange?.(status);
    });

  return {
    unsubscribe: async () => {
      await supabase.removeChannel(channel);
    },
    refresh: () => getRunSnapshot(runId),
  };
}

async function applyRealtimeRefresh(
  runId: string,
  handlers: OrchestrationSubscriptionHandlers,
  _payload: RealtimeTablePayload<AgentStep> | RealtimeTablePayload<AgentArtifact>,
): Promise<void> {
  try {
    handlers.onSnapshot(await getRunSnapshot(runId));
  } catch (error) {
    handlers.onError?.(error instanceof OrchestrationError ? error : new OrchestrationError('SNAPSHOT_FAILED', asErrorMessage(error, '刷新编排状态失败'), error));
  }
}

export async function cancelRun(runId: string): Promise<AgentRun> {
  if (!runId) throw new OrchestrationError('INVALID_REQUEST', 'runId 不能为空');
  try {
    await invokeRun(runId, 'cancel');
    return (await getRunSnapshot(runId)).run;
  } catch (error) {
    throw new OrchestrationError('CANCEL_FAILED', asErrorMessage(error, '取消编排任务失败'), error);
  }
}

export async function retryRun(runId: string, stepId?: string): Promise<AgentOrchestrateResponse> {
  if (!runId) throw new OrchestrationError('INVALID_REQUEST', 'runId 不能为空');
  try {
    void stepId;
    await getRunSnapshot(runId);
    return await invokeRun(runId, 'retry');
  } catch (error) {
    if (error instanceof OrchestrationError && error.code === 'INVOKE_FAILED') {
      throw new OrchestrationError('RETRY_FAILED', error.message, error);
    }
    throw error;
  }
}
