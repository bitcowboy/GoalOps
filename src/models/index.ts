/**
 * 与 PRD 实体对齐的前端类型（字段可与 PocketBase collection 不完全一致时再映射）。
 */

export type ObjectiveStatus = 'not_started' | 'in_progress' | 'at_risk' | 'done' | 'cancelled'

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
}

export interface Deliverable {
  id: string
  objectiveId: string
  title: string
  status: string
}

export interface CoreDocument {
  id: string
  objectiveId: string
  title: string
  url: string
}

export interface Blocker {
  id: string
  objectiveId: string
  description: string
  severity: string
}

export interface MiscWork {
  id: string
  memberId: string
  title: string
  kind: 'meeting' | 'ad_hoc' | string
  hours: number
}
