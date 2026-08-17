import type {
  AgentArtifact,
  AgentResourceType,
  AgentRun,
  AgentRunStatus,
  AgentStep,
  JsonObject,
} from '@/types/types';

export const ORCHESTRATION_RESOURCE_TYPES = [
  'document',
  'mindmap',
  'exercise',
  'reading',
  'code',
  'micro_lesson',
] as const satisfies readonly AgentResourceType[];

export type OrchestrationResourceType = (typeof ORCHESTRATION_RESOURCE_TYPES)[number];
export type OrchestrationWorkflowType = 'resource_generate' | 'learning_adapt';

export interface OrchestrationRequest {
  courseId: string;
  request: string;
  portraitVersion?: number | null;
  selectedResourceTypes: OrchestrationResourceType[];
  workflowType?: OrchestrationWorkflowType;
  context?: JsonObject;
  idempotencyKey?: string;
}

export interface CreateRunRequest extends OrchestrationRequest {
  userId: string;
}

export interface AgentOrchestrateRequest {
  action: 'start' | 'cancel' | 'retry';
  run_id: string;
}

export interface AgentOrchestrateResponse {
  run_id: string;
  status: AgentRunStatus;
  accepted?: boolean;
  message?: string;
}

export interface AgentRunSnapshot {
  run: AgentRun;
  steps: AgentStep[];
  artifacts: AgentArtifact[];
}

export type RealtimeChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeTablePayload<T> {
  eventType: RealtimeChangeType;
  schema: string;
  table: 'agent_runs' | 'agent_steps' | 'agent_artifacts';
  new: T | Record<string, never>;
  old: Partial<T> | Record<string, never>;
  commit_timestamp?: string;
  errors?: string[];
}

export type OrchestrationRealtimePayload =
  | RealtimeTablePayload<AgentRun>
  | RealtimeTablePayload<AgentStep>
  | RealtimeTablePayload<AgentArtifact>;

export interface OrchestrationSubscriptionHandlers {
  onSnapshot: (snapshot: AgentRunSnapshot) => void;
  onError?: (error: OrchestrationError) => void;
  onStatusChange?: (status: string) => void;
}

export interface OrchestrationSubscription {
  unsubscribe: () => Promise<void>;
  refresh: () => Promise<AgentRunSnapshot>;
}

export type OrchestrationErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_REQUEST'
  | 'CREATE_RUN_FAILED'
  | 'INVOKE_FAILED'
  | 'SNAPSHOT_FAILED'
  | 'SUBSCRIPTION_FAILED'
  | 'CANCEL_FAILED'
  | 'RETRY_FAILED';

export class OrchestrationError extends Error {
  readonly code: OrchestrationErrorCode;
  readonly causeValue?: unknown;

  constructor(code: OrchestrationErrorCode, message: string, causeValue?: unknown) {
    super(message);
    this.name = 'OrchestrationError';
    this.code = code;
    this.causeValue = causeValue;
  }
}
