export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface Profile {
  id: string;
  username: string | null;
  phone: string | null;
  email: string | null;
  major: string;
  education: string;
  learning_goal: string;
  avatar_url: string | null;
  bio: string | null;
  theme_preference: string | null;
  notification_settings: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
}

export interface LearningPortrait {
  id: string;
  user_id: string;
  knowledge_base: Record<string, unknown>;
  cognitive_style: Record<string, unknown>;
  error_patterns: Record<string, unknown>;
  learning_rhythm: Record<string, unknown>;
  learning_goals: Record<string, unknown>;
  major_direction: Record<string, unknown>;
  raw_data: Record<string, unknown>;
  is_complete: boolean;
  created_at: string;
  updated_at: string;
  version?: number;
  last_revision_id?: string | null;
  last_updated_at?: string | null;
}

export interface Course {
  id: string;
  name: string;
  major: string;
  description: string;
  chapters: string[];
  created_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  code: string;
  title: string;
  description?: string | null;
  order: number;
  learning_objectives: string[];
  estimated_hours?: number | null;
  metadata?: JsonObject;
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgePoint {
  id: string;
  course_id: string;
  module_id: string | null;
  code: string;
  title: string;
  description?: string | null;
  difficulty?: string | null;
  keywords: string[];
  metadata?: JsonObject;
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgeEvidence {
  id?: string;
  course_id: string;
  knowledge_point_id: string | null;
  document_id?: string | null;
  chunk_id?: string | null;
  resource_id?: string | null;
  quote?: string | null;
  source_title?: string | null;
  source_url?: string | null;
  relevance?: number | null;
  purpose?: string | null;
  rank?: number | null;
  metadata?: JsonObject;
}

export interface Resource {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  resource_type: 'document' | 'mindmap' | 'exercise' | 'reading' | 'code' | 'ppt' | 'video' | 'micro_lesson';
  content: string | Record<string, unknown> | unknown[];
  chapter: string | null;
  status: 'generating' | 'completed' | 'failed';
  is_read: boolean;
  is_edited: boolean;
  version: number;
  original_content: string | Record<string, unknown> | unknown[] | null;
  tags: string[];
  rating: number;
  rating_count: number;
  view_count: number;
  favorite_count: number;
  source: 'ai' | 'agent' | 'manual';
  created_at: string;
  updated_at: string;
  agent_run_id?: string | null;
  quality_status?: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'failed' | null;
  quality_score?: number | null;
  is_favorited?: boolean;
  user_rating?: number;
}

export interface LearningPath {
  id: string;
  user_id: string;
  title: string;
  stages: PathStage[];
  current_stage: number;
  progress_percent: number;
  created_at: string;
  updated_at: string;
  course_id?: string | null;
  version?: number;
  reasoning?: JsonObject | null;
  source_event_id?: string | null;
}

export interface PathStage {
  id: string;
  title: string;
  description: string;
  order: number;
  resources: string[];
  completed: boolean;
}

export interface PathStageV2 extends PathStage {
  knowledgePointIds: string[];
  resourceIds: string[];
  recommendedReason?: string | null;
  completedAt?: string | null;
  sourceEventId?: string | null;
  status?: 'locked' | 'active' | 'available' | 'in_progress' | 'completed';
}

export interface LearningPathV2 extends Omit<LearningPath, 'stages'> {
  stages: PathStageV2[];
}

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentStepStatus = AgentRunStatus;
export type AgentArtifactStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentRole = 'analyst' | 'curator' | 'designer' | 'creator' | 'reviewer' | 'publisher' | 'path_planner';
export type AgentResourceType = 'document' | 'mindmap' | 'exercise' | 'reading' | 'code' | 'video' | 'ppt' | 'micro_lesson';

export interface AgentRun {
  id: string;
  user_id: string;
  run_type: 'resource_generate' | 'learning_adapt' | string;
  course_id: string | null;
  status: AgentRunStatus;
  input?: JsonObject | null;
  output?: JsonObject | null;
  error?: string | null;
  requested_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  idempotency_key?: string | null;
  cancel_requested?: boolean;
  lease_token?: string | null;
  lease_expires_at?: string | null;
  attempt_count?: number;
  /** @deprecated Display-only compatibility alias. Use error. */
  error_summary?: string | null;
}

export interface AgentStep {
  id: string;
  run_id: string;
  step_key: AgentRole | string;
  status: AgentStepStatus;
  input?: JsonObject | null;
  output?: JsonObject | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  /** @deprecated Display-only compatibility alias. Use step_key. */
  role?: AgentRole | string;
  /** @deprecated Legacy ordering field; runtime orders by step_key/created_at. */
  sequence?: number;
  /** @deprecated Display-only compatibility alias. Use input. */
  input_summary?: JsonObject | null;
  /** @deprecated Display-only compatibility alias. Use output. */
  output_summary?: JsonObject | null;
  /** @deprecated Display-only compatibility field. */
  attempt_count?: number;
  /** @deprecated Display-only compatibility field. */
  duration_ms?: number | null;
}

export interface AgentArtifact {
  id: string;
  run_id: string;
  step_id?: string | null;
  artifact_type: AgentResourceType | string;
  status: AgentArtifactStatus;
  title?: string | null;
  content?: JsonObject | null;
  storage_path?: string | null;
  content_hash?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
  /** @deprecated Display-only compatibility alias. Use artifact_type. */
  resource_type?: AgentResourceType | string;
  /** @deprecated Display-only compatibility field. */
  quality_score?: number | null;
}

export type LearningEventType =
  | 'resource_viewed'
  | 'resource_completed'
  | 'exercise_submitted'
  | 'weakness_training_completed'
  | 'path_stage_completed'
  | 'resource_feedback';
export type LearningEventStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'ignored';

export type LearningEventReferences = JsonObject & {
  resource_id?: string;
  exercise_id?: string;
  submission_id?: string;
};

export interface LearningEvent {
  id: string;
  user_id: string;
  course_id: string | null;
  knowledge_point_id?: string | null;
  event_type: LearningEventType;
  idempotency_key: string;
  payload: JsonObject & { references?: LearningEventReferences };
  occurred_at: string;
  processing_status: LearningEventStatus;
  processed_at?: string | null;
  processing_error?: string | null;
  created_at: string;
}

export interface KnowledgeMastery {
  user_id: string;
  course_id: string;
  knowledge_point_id: string;
  mastery_score: number;
  confidence: number;
  evidence_count: number;
  last_event_id?: string | null;
  last_assessed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortraitRevision {
  id: string;
  user_id: string;
  portrait_id: string;
  version: number;
  source_event_id?: string | null;
  snapshot: JsonObject;
  reason: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  session_type: 'portrait' | 'tutoring';
  role: 'user' | 'assistant';
  content: string;
  related_resources: string[];
  created_at: string;
}

export type ExerciseQuestionType = 'single' | 'multiple' | 'subjective';
export type ExerciseAnswer = string | string[];
export type ExerciseAiStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface ExerciseLocalResult {
  is_correct: boolean;
  score: 100 | 0;
}

export interface ExerciseAiResult {
  is_correct: boolean;
  score: number;
  feedback: string;
  analysis: string;
  suggestions: string;
  strengths?: string[];
  improvements?: string[];
  dimensions?: Array<{ name: string; score: number }>;
}

export interface ExerciseSubmission {
  id: string;
  user_id: string;
  exercise_id: string;
  user_answer: string;
  is_correct: boolean | null;
  ai_score: number | null;
  ai_feedback: string | null;
  ai_status: ExerciseAiStatus;
  ai_analysis: string | null;
  ai_suggestions: string | null;
  ai_request_id: string | null;
  time_spent: number;
  created_at: string;
}

export interface Exercise {
  id: string;
  resource_id: string | null;
  question: string;
  question_type?: ExerciseQuestionType;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
  category: string | null;
  tags: string[];
  ai_generated: boolean;
  created_at: string;
  source_resource_id?: string;
  source_title?: string;
}

export interface UserExercise {
  id: string;
  user_id: string;
  exercise_id: string;
  user_answer: string | null;
  is_correct: boolean;
  created_at: string;
}

export type UserExerciseSubmission = ExerciseSubmission;

export interface WrongBookEntry {
  id: string;
  user_id: string;
  exercise_id: string;
  submission_id: string | null;
  note: string | null;
  mastered: boolean;
  created_at: string;
  exercises?: Exercise;
}

export interface Favorite {
  id: string;
  user_id: string;
  resource_id: string;
  created_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  resource_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  session_date: string;
}

export interface Evaluation {
  id: string;
  user_id: string;
  knowledge_score: number;
  efficiency_score: number;
  weakness_analysis: Record<string, unknown>;
  suggestions: string[];
  trend_data: TrendPoint[];
  created_at: string;
  score?: number;
  is_correct?: boolean;
  time_spent?: number;
  exercise_id?: string;
}

export interface TrendPoint {
  date: string;
  knowledge: number;
  efficiency: number;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  post_type: 'share' | 'question' | 'discussion';
  title: string | null;
  content: string;
  resource_id: string | null;
  likes_count: number;
  likes?: number;
  replies_count: number;
  reply_count?: number;
  is_featured?: boolean;
  is_pinned?: boolean;
  created_at: string;
  user_profiles?: Profile;
  is_liked?: boolean;
}

export interface CommunityReply {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes?: number;
  user_profiles?: Profile;
}

export interface UserProgress {
  id: string;
  user_id: string;
  resource_id: string | null;
  view_duration: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  document: '教学案例',
  mindmap: '思维导图',
  exercise: '练习题',
  reading: '动画演示',
  code: '代码示例',
  ppt: '课件PPT',
  video: '教学短视频',
};

export const RESOURCE_TYPE_ICONS: Record<string, string> = {
  document: '📄',
  mindmap: '🧠',
  exercise: '✏️',
  reading: '🎥',
  code: '💻',
  ppt: '📊',
  video: '🎬',
};

export interface DailyTodo {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_done: boolean;
  due_date: string;
  priority: 'low' | 'medium' | 'high';
  source: 'manual' | 'path' | 'ai';
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  resource_id: string | null;
  exercise_id: string | null;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface UserCheckIn {
  id: string;
  user_id: string;
  check_date: string;
  study_minutes: number;
  created_at: string;
}

export interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
  badge?: Badge;
}

export interface StudyReport {
  id: string;
  user_id: string;
  period_type: 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  total_minutes: number;
  total_resources: number;
  total_exercises: number;
  correct_rate: number;
  ai_summary: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_minutes: number;
  rank: number;
}
