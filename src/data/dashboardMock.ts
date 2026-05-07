/** Dashboard mock view-models — names align with PocketBase `objectives` where applicable. */

export type GoalHealth = 'normal' | 'risk' | 'blocked'

export type DashboardGoalRow = {
  id: string
  name: string
  definition: string
  progress_percent: number
  health: GoalHealth
  priority: '高' | '中' | '低'
  owner_name: string
  owner_team: string
  owner_initials: string
  owner_color: string
  blockers: string
  next_action: string
  next_action_date: string
  updated_at: string
}

export type RiskItem = {
  id: string
  level: 'critical' | 'warning'
  title: string
  impact: string
  time: string
}

export type MeetingItem = {
  id: string
  kind: '会议' | '评审' | '同步'
  title: string
  date: string
  range: string
}

export type ActionSuggestion = {
  id: string
  title: string
  priority: '高' | '中'
  done?: boolean
}

export const dashboardKpi = {
  period_label: '2025 Q2',
  period_range: '04.01 - 06.30',
  total_goals: 4,
  normal_goals: { count: 2, pct: 50 },
  risk_goals: { count: 1, pct: 25 },
  high_priority_tasks: { count: 12, delta: '+2' },
  team_occupancy_pct: 78,
  team_occupancy_delta: '+6%',
}

export const dashboardGoals: DashboardGoalRow[] = [
  {
    id: 'obj100000000001',
    name: 'AI 创作大赛小游戏开发平台',
    definition: '搭建面向创作者的 AI 驱动小游戏开发平台，降低创作门槛，激发生态活力。',
    progress_percent: 68,
    health: 'normal',
    priority: '高',
    owner_name: '张雨薇',
    owner_team: 'AI 创作平台组',
    owner_initials: 'ZY',
    owner_color: '#2563eb',
    blockers: '评审口径待业务确认',
    next_action: '完成初赛名单公示',
    next_action_date: '05-12',
    updated_at: '2 小时前',
  },
  {
    id: 'obj200000000002',
    name: '剑网3 智能客服',
    definition: '构建大模型驱动的智能客服体系，提升问题解决率与用户满意度。',
    progress_percent: 42,
    health: 'risk',
    priority: '高',
    owner_name: '王皓',
    owner_team: '智能客服组',
    owner_initials: 'WH',
    owner_color: '#ea580c',
    blockers: '第三方 SDK 版本兼容',
    next_action: '联调灰度环境',
    next_action_date: '05-14',
    updated_at: '昨天',
  },
  {
    id: 'obj300000000003',
    name: 'VLA 模型训练',
    definition: '训练多模态 VLA 模型，提升游戏 AI 在复杂场景下的理解与决策能力。',
    progress_percent: 33,
    health: 'blocked',
    priority: '高',
    owner_name: '陈子墨',
    owner_team: 'VLA 训练组',
    owner_initials: 'CZ',
    owner_color: '#7c3aed',
    blockers: 'GPU 资源排队',
    next_action: '提交扩容申请',
    next_action_date: '05-08',
    updated_at: '3 天前',
  },
  {
    id: 'obj400000000004',
    name: 'RTS 项目原型验证',
    definition: '验证核心玩法与技术可行性，输出可演示的 Alpha 原型。',
    progress_percent: 55,
    health: 'normal',
    priority: '高',
    owner_name: '刘凯',
    owner_team: '游戏组',
    owner_initials: 'LK',
    owner_color: '#059669',
    blockers: '原型关卡脚本与验收 checklist 尚未对齐',
    next_action: '补齐 RTS Demo 场景脚本与验收 checklist',
    next_action_date: '05-18',
    updated_at: '30 分钟前',
  },
]

export const dashboardRisks: RiskItem[] = [
  {
    id: 'r1',
    level: 'critical',
    title: 'GPU 资源缺口扩大',
    impact: 'VLA 训练里程碑可能顺延 1 周。',
    time: '今天 09:20',
  },
  {
    id: 'r2',
    level: 'warning',
    title: '客服 SDK 兼容风险',
    impact: '灰度窗口需要额外回归用例。',
    time: '昨天 18:05',
  },
  {
    id: 'r3',
    level: 'warning',
    title: '评审口径未对齐',
    impact: '创意大赛进度评估不稳定。',
    time: '昨天 11:40',
  },
]

export const dashboardMeetings: MeetingItem[] = [
  {
    id: 'm1',
    kind: '会议',
    title: '部门周会',
    date: '05-07',
    range: '10:00 - 11:00',
  },
  {
    id: 'm2',
    kind: '评审',
    title: '创意大赛初赛评审',
    date: '05-09',
    range: '14:00 - 17:00',
  },
  {
    id: 'm3',
    kind: '同步',
    title: 'RTS 接口冻结对齐',
    date: '05-10',
    range: '15:30 - 16:00',
  },
]

export const dashboardSuggestions: ActionSuggestion[] = [
  { id: 's1', title: '确认 GPU 扩容审批链路与时限', priority: '高' },
  { id: 's2', title: '补齐客服灰度回归清单（P0 场景）', priority: '高' },
  { id: 's3', title: '将评审口径同步至项目组 Wiki', priority: '中' },
  { id: 's4', title: '预约 RTS 干系人集成测试窗口', priority: '中' },
]

/** Future: map PocketBase records → `DashboardGoalRow[]`. */
export function mapPocketBaseToDashboardGoals(): DashboardGoalRow[] {
  return []
}
