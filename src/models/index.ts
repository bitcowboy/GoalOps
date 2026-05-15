/**
 * 与 PRD 实体对齐的前端类型（字段可与 PocketBase collection 不完全一致时再映射）。
 */

export type ObjectiveStatus =
  | 'not_started'
  | 'explore_plan'
  | 'in_progress'
  | 'paused'
  | 'in_review'
  | 'done'
  | 'cancelled'

export type PhaseStepStatus = 'done' | 'in_progress' | 'not_started'

/** objectives.phase_timeline JSON 单项（与迁移种子一致） */
export interface ObjectivePhaseStep {
  title: string
  status: PhaseStepStatus
  progress_percent?: number
  date_range: string
}

/** objectives.next_actions JSON 单项（与迁移种子一致） */
export interface ObjectiveNextActionJson {
  suggestion: string
  type: string
  priority: string
  suggester_name: string
  suggester_initials: string
  suggester_color?: string
  suggestion_date: string
}

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'deliver'
  | 'review'
  | 'done'

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'

export interface Objective {
  id: string
  name: string
  definition: string
  progressPercent: number
  status: ObjectiveStatus | string
  priority: Priority | string
  ownerId: string
  startDate: string
  dueDate: string
  /** 详情页扩展字段（可选，取决于后端是否已迁移） */
  displayCode?: string
  successCriteria?: string[]
  outOfScope?: string[]
  phaseTimeline?: ObjectivePhaseStep[]
  nextActions?: ObjectiveNextActionJson[]
  progressDeltaPercent?: number | null
}

export type MemberStatus = 'active' | 'inactive'

export type KRType = 'metric' | 'checkbox' | 'milestone'
export type KRDirection = 'increase' | 'decrease'

/** PRD: 关键结果（metric / checkbox / milestone 三类） */
export interface KeyResult {
  id: string
  objectiveId: string
  name: string
  /** 兼容旧字段；metric/milestone 不再用它推进度 */
  isCompleted: boolean
  ownerId?: string
  note?: string
  sortOrder?: number
  createdAt?: string
  updatedAt?: string
  krType?: KRType
  startValue?: number | null
  targetValue?: number | null
  unit?: string
  direction?: KRDirection | null
  contributorIds?: string[]
}

/** /api/goalops/key_results/:id/derived 返回结构 */
export interface KRDerived {
  key_result: string
  kr_type: KRType
  start_value: number | null
  target_value: number | null
  unit: string
  direction: KRDirection | null
  latest_value: number | null
  latest_confidence: number | null
  latest_checkin_date: string | null
  score: number | null
}

export type CheckinType = 'weekly' | 'milestone' | 'adhoc'
export type StatusSignal = 'on_track' | 'at_risk' | 'off_track'

/** kr_checkins 单条记录 */
export interface KRCheckin {
  id: string
  keyResultId: string
  checkinDate: string
  checkinType: CheckinType
  currentValue?: number | null
  progressPercent?: number | null
  isCompleted?: boolean
  confidence: number
  statusSignal: StatusSignal
  progressNote: string
  blockersNote?: string
  nextFocus?: string
  authorId: string
  created?: string
  updated?: string
}

export interface Member {
  id: string
  name: string
  role: string
  team: string
  weeklyAvailableHours: number
  /** PocketBase 历史行可能为空，视为 active */
  status?: MemberStatus | string
}

export interface Task {
  id: string
  objectiveId: string
  /** 可选关联 KR */
  keyResultId?: string
  title: string
  assigneeId: string
  status: TaskStatus | string
  priority: Priority | string
  /** 前置任务 id 列表 */
  predecessorIds: string[]
  estimateHours?: number
  dueDate?: string
}

export interface Deliverable {
  id: string
  objectiveId: string
  title: string
  status: string
  version?: string
  plannedCompletionDate?: string
}

export interface CoreDocument {
  id: string
  objectiveId: string
  title: string
  url: string
  version?: string
  docStatus?: string
  ownerId?: string
}

export interface Blocker {
  id: string
  objectiveId: string
  description: string
  severity: string
  ownerId?: string
  targetResolutionDate?: string
}
