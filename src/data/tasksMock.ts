/** Tasks list page mock — aligns with `Doc/UI Mockup/Tasks.png`; swap for PocketBase later. */

export type TaskDisplayStatus = 'pending' | 'in_progress' | 'review' | 'blocked'

export type TaskRiskLevel = 'normal' | 'risk' | 'high'

export type TasksObjectiveOption = {
  id: string
  name: string
  dotColor: string
}

export type TasksAssigneeOption = {
  id: string
  name: string
  initials: string
  avatarColor: string
}

export type TaskRowMock = {
  id: string
  objectiveId: string
  objectiveName: string
  objectiveDotColor: string
  title: string
  status: TaskDisplayStatus
  assigneeId: string
  assigneeName: string
  assigneeInitials: string
  assigneeAvatarColor: string
  prerequisite: string | null
  priorityLabel: '高' | '中' | '低'
  /** ISO date `YYYY-MM-DD` */
  dueIso: string
  estimatedHours: number
  risk: TaskRiskLevel
  /** Listed in 孤儿任务 sidebar */
  isOrphan?: boolean
}

export type DependencyRiskAlert = {
  id: string
  /** critical | warning dot */
  level: 'critical' | 'warning'
  taskTitle: string
  dependencyNote: string
  blockedForLabel: string
}

export type OrphanTaskAlert = {
  id: string
  title: string
  assigneeInitials: string
  assigneeAvatarColor: string
}

const OBJECTIVES: TasksObjectiveOption[] = [
  { id: 'obj100000000001', name: 'AI 创作大赛小游戏开发平台', dotColor: '#7c3aed' },
  { id: 'obj200000000002', name: '剑网3 智能客服', dotColor: '#2563eb' },
  { id: 'obj300000000003', name: 'VLA 模型训练', dotColor: '#059669' },
  { id: 'obj400000000004', name: 'RTS 项目原型验证', dotColor: '#ea580c' },
]

export const tasksAssigneeOptions: TasksAssigneeOption[] = [
  { id: 'u1', name: '张晨曦', initials: 'ZC', avatarColor: '#7c3aed' },
  { id: 'me', name: '李雷', initials: 'L', avatarColor: '#7c3aed' },
  { id: 'u3', name: '韩洋', initials: 'HY', avatarColor: '#2563eb' },
  { id: 'u4', name: '陆琳', initials: 'LL', avatarColor: '#059669' },
  { id: 'u5', name: '陈子墨', initials: 'CZ', avatarColor: '#ea580c' },
  { id: 'u6', name: '王皓', initials: 'WH', avatarColor: '#64748b' },
]

const TITLE_STEMS = [
  '接口契约评审与对齐',
  '灰度环境联调与验收',
  'GPU 资源扩容申请',
  '前端组件库暗色模式',
  '评测集标注规范更新',
  'Prompt 模板版本冻结',
  '依赖服务降级策略',
  '埋点与漏斗看板接入',
  '多模态数据清洗流水线',
  '客服知识库冷启动',
  'Alpha 原型关卡脚本',
  '评审 checklist 同步',
  '阻塞项升级与同步',
  '里程碑风险复盘',
  '交付物版本号规范',
  '测试用例补齐（P0）',
  '运维 Runbook 编写',
  '安全扫描项修复',
]

const PREREQS = [
  null,
  null,
  null,
  '完成接口评审',
  '等待 SDK 发版',
  'GPU 配额审批',
  '产品口径确认',
  '设计稿定稿',
]

function statusPatternForIndex(i: number): TaskDisplayStatus {
  // Deterministic mix ≈ screenshot: 32 in progress, 12 review, 6 blocked, rest pending
  if (i < 32) return 'in_progress'
  if (i < 44) return 'review'
  if (i < 50) return 'blocked'
  return 'pending'
}

function riskForIndex(i: number, status: TaskDisplayStatus): TaskRiskLevel {
  if (status === 'blocked') return i % 3 === 0 ? 'high' : 'risk'
  if (i % 11 === 0) return 'high'
  if (i % 5 === 0) return 'risk'
  return 'normal'
}

function priorityForIndex(i: number): '高' | '中' | '低' {
  const r = i % 9
  if (r < 3) return '高'
  if (r < 6) return '中'
  return '低'
}

function dueIsoForIndex(i: number): string {
  const month = 5
  const day = 6 + ((i * 3) % 24)
  const d = Math.min(30, Math.max(6, day))
  return `2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function buildTaskRow(i: number): TaskRowMock {
  const obj = OBJECTIVES[i % OBJECTIVES.length]!
  const assignee = tasksAssigneeOptions[i % tasksAssigneeOptions.length]!
  const status = statusPatternForIndex(i)
  const risk = riskForIndex(i, status)
  const hours = 4 + ((i * 7) % 32)

  const isOrphan = i === 61 || i === 64 || i === 66

  return {
    id: `tsk${String(i + 1).padStart(4, '0')}`,
    objectiveId: isOrphan ? 'orphan' : obj.id,
    objectiveName: isOrphan ? '未关联目标' : obj.name,
    objectiveDotColor: isOrphan ? '#94a3b8' : obj.dotColor,
    title: `${TITLE_STEMS[i % TITLE_STEMS.length]} · ${Math.floor(i / TITLE_STEMS.length) + 1}`,
    status,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    assigneeInitials: assignee.initials,
    assigneeAvatarColor: assignee.avatarColor,
    prerequisite: PREREQS[i % PREREQS.length],
    priorityLabel: priorityForIndex(i),
    dueIso: dueIsoForIndex(i),
    estimatedHours: hours,
    risk,
    isOrphan,
  }
}

/** Full task board — 68 rows like mock screenshot */
export const tasksBoardRows: TaskRowMock[] = Array.from({ length: 68 }, (_, i) => buildTaskRow(i))

export const tasksKpi = {
  total: 68,
  totalDeltaLabel: '较上周 +8',
  in_progress: { count: 32, pct: 47 },
  pending_review: { count: 12, pct: 18 },
  blocked: { count: 6, pct: 9 },
  due_this_week: { count: 11, deltaLabel: '较上周 +3' },
}

/** Sidebar — dependency risks */
export const dependencyRiskAlerts: DependencyRiskAlert[] = [
  {
    id: 'dr1',
    level: 'critical',
    taskTitle: '灰度环境联调与验收 · 2',
    dependencyNote: '前置：客服 SDK 兼容分支未合并',
    blockedForLabel: '阻塞时长: 2天',
  },
  {
    id: 'dr2',
    level: 'warning',
    taskTitle: 'GPU 资源扩容申请 · 5',
    dependencyNote: '前置：预算审批待财务确认',
    blockedForLabel: '阻塞时长: 1天',
  },
  {
    id: 'dr3',
    level: 'warning',
    taskTitle: '评审 checklist 同步 · 3',
    dependencyNote: '前置：业务口径邮件未回',
    blockedForLabel: '阻塞时长: 4小时',
  },
]

/** Sidebar — orphan tasks teaser */
export const orphanTaskAlerts: OrphanTaskAlert[] = tasksBoardRows
  .filter((t) => t.isOrphan)
  .slice(0, 3)
  .map((t) => ({
    id: t.id,
    title: t.title,
    assigneeInitials: t.assigneeInitials,
    assigneeAvatarColor: t.assigneeAvatarColor,
  }))

/** Task health donut — counts sum to `tasksKpi.total` */
export const taskHealthSlices = {
  normal: { count: 41, label: '正常', pct: 60 },
  risk: { count: 11, label: '风险', pct: 16 },
  blocked: { count: 6, label: '阻塞', pct: 9 },
  not_started: { count: 10, label: '未开始', pct: 15 },
}

export const taskHealthTrendLabel = '较上周 ▲ 8%'

export const tasksObjectiveFilterOptions: { value: string; label: string }[] = [
  { value: '', label: '全部目标' },
  ...OBJECTIVES.map((o) => ({ value: o.id, label: o.name })),
  { value: 'orphan', label: '未关联目标' },
]

export const tasksStatusFilterOptions: { value: string; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'review', label: '待验收' },
  { value: 'blocked', label: '已阻塞' },
]

export const tasksPriorityFilterOptions: { value: string; label: string }[] = [
  { value: '', label: '全部优先级' },
  { value: '高', label: '高' },
  { value: '中', label: '中' },
  { value: '低', label: '低' },
]

export const tasksAssigneeFilterOptions: { value: string; label: string }[] = [
  { value: '', label: '全部负责人' },
  ...tasksAssigneeOptions.map((a) => ({ value: a.id, label: a.name })),
]
