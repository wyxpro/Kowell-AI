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
}

export interface Course {
  id: string;
  name: string;
  major: string;
  description: string;
  chapters: string[];
  created_at: string;
}

export interface Resource {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  resource_type: 'document' | 'mindmap' | 'exercise' | 'reading' | 'code' | 'ppt' | 'video';
  content: string | Record<string, unknown>;
  chapter: string | null;
  status: 'generating' | 'completed' | 'failed';
  is_read: boolean;
  is_edited: boolean;
  version: number;
  original_content: string | Record<string, unknown> | null;
  tags: string[];
  rating: number;
  rating_count: number;
  view_count: number;
  favorite_count: number;
  source: 'ai' | 'manual';
  created_at: string;
  updated_at: string;
  // 前端聚合字段
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
}

export interface PathStage {
  id: string;
  title: string;
  description: string;
  order: number;
  resources: string[];
  completed: boolean;
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

export interface Exercise {
  id: string;
  resource_id: string | null;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
  category: string | null;
  tags: string[];
  ai_generated: boolean;
  created_at: string;
  // 资源中心来源（前端扩展字段）
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

export interface UserExerciseSubmission {
  id: string;
  user_id: string;
  exercise_id: string;
  user_answer: string;
  is_correct: boolean | null;
  ai_score: number | null;
  ai_feedback: string | null;
  time_spent: number;
  created_at: string;
}

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

// 今日待办
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

// 笔记
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

// 每日打卡
export interface UserCheckIn {
  id: string;
  user_id: string;
  check_date: string;
  study_minutes: number;
  created_at: string;
}

// 徽章定义
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

// 用户徽章
export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
  badge?: Badge;
}

// 学习报告
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

// 排行榜条目
export interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  total_minutes: number;
  rank: number;
}

