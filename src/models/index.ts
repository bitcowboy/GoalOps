/**
 * 与 PRD 实体对齐的前端类型（字段可与 PocketBase collection 不完全一致时再映射）。
 */

export type ObjectiveStatus = 'not_started' | 'in_progress' | 'at_risk' | 'done' | 'cancelled'

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
  background?: string
  successCriteria?: string[]
  outOfScope?: string[]
  phaseTimeline?: ObjectivePhaseStep[]
  nextActions?: ObjectiveNextActionJson[]
  progressDeltaPercent?: number | null
}

export interface Member {
  id: string
  name: string
  role: string
  team: string
  weeklyAvailableHours: number
}

export interface Task {
  id: string
  objectiveId: string
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

export interface MiscWork {
  id: string
  memberId: string
  title: string
  kind: 'meeting' | 'ad_hoc' | string
  hours: number
}
