import type { RecordModel } from 'pocketbase'
import {
  clampPercent,
  editorToPlainText,
  formatDotDate,
  initialsFromName,
  parseNextActions,
} from '@/features/objectives/objectiveDetailUtils'
import { krCompletionFromRows } from '@/features/objectives/keyResults'
import { pb } from '@/services/pocketbase'

/** Base path for objective detail URLs. */
export const OBJECTIVE_ROUTE = '/objectives'

export type ObjectiveBlockerItem = {
  description: string
  severity: string
}

/** Maps PocketBase blocker severity to dashboard risk tiers. */
export function blockerSeverityLevel(raw: unknown): 'high' | 'medium' | 'low' {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'high' || s === 'critical' || s === '高') return 'high'
  if (s === 'medium' || s === '中') return 'medium'
  return 'low'
}

function blockerItemsSorted(blockerList: RecordModel[] | undefined): ObjectiveBlockerItem[] {
  if (!blockerList?.length) return []
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const sorted = [...blockerList].sort(
    (a, b) =>
      (rank[String(a.severity ?? '').toLowerCase()] ?? 99) -
      (rank[String(b.severity ?? '').toLowerCase()] ?? 99),
  )
  return sorted.map((b) => ({
    description: String(b.description ?? '').trim(),
    severity: String(b.severity ?? 'low').toLowerCase(),
  }))
}

/** Aligns with dashboard「健康度」semantics. */
export type ObjectiveListHealth = 'normal' | 'risk' | 'blocked'

/** Table row shape matches `DashboardGoalRow` for UI reuse. */
export type ObjectiveListRow = {
  id: string
  name: string
  definition: string
  progress_percent: number
  health: ObjectiveListHealth
  priority: '高' | '中' | '低'
  owner_name: string
  owner_team: string
  owner_initials: string
  owner_color: string
  blockers: string
  next_action: string
  next_action_date: string
  updated_at: string
  /** Checkbox KR summary */
  kr_completed: number
  kr_total: number
  kr_percent: number | null
  /** 执行任务完成率展示 */
  task_completed: number
  task_total: number
  /** 条状进度：KR 优先，否则 PocketBase progress_percent */
  progress_display_pct: number
  blockers_count: number
  /** Per-blocker lines for dashboards / drill-down */
  blocker_items: ObjectiveBlockerItem[]
}

export type ObjectivesListKpi = {
  period_label: string
  period_range: string
  total_goals: number
  normal_goals: { count: number; pct: number }
  risk_goals: { count: number; pct: number }
  high_priority_tasks: { count: number; delta: string }
  /** 有 KR 的目标之 KR 完成率简单平均（无 KR 时为 null） */
  avg_kr_completion_pct: number | null
  avg_progress_pct: number
  avg_progress_delta: string
  /** 未完结且未取消的目标数 */
  active_objectives_count: number
  /** 至少有一条阻塞记录的目标数 */
  blocked_objectives_count: number
  total_blockers: number
  team_members_count: number
}

export type ObjectivesListPayload = {
  rows: ObjectiveListRow[]
  kpis: ObjectivesListKpi
  sparkline_points: number[]
}

const ASSIGNEE_DOT_PALETTE = ['#64748b', '#7c3aed', '#2563eb', '#059669', '#ea580c', '#0d9488'] as const

function hashBucket(id: string, mod: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % mod
}

function ownerAvatarColor(memberId: string): string {
  return ASSIGNEE_DOT_PALETTE[hashBucket(memberId, ASSIGNEE_DOT_PALETTE.length)]!
}

function currentQuarterPeriod(): { label: string; range: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const q = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4
  const startMonth = q === 1 ? 1 : q === 2 ? 4 : q === 3 ? 7 : 10
  const endMonth = startMonth + 2
  const pad = (n: number) => `${n}`.padStart(2, '0')
  const endDay = endMonth === 12 ? 31 : new Date(y, endMonth, 0).getDate()
  const label = `${y} Q${q}`
  const range = `${pad(startMonth)}.01 - ${pad(endMonth)}.${pad(endDay)}`
  return { label, range }
}

function blockedObjectiveIdsFrom(blockers: RecordModel[]): Set<string> {
  const s = new Set<string>()
  for (const b of blockers) {
    const oid = b.objective
    if (typeof oid === 'string' && oid) s.add(oid)
  }
  return s
}

function blockersSummaryForObjective(objsBlockers: RecordModel[] | undefined): string {
  if (!objsBlockers?.length) return '—'
  const parts = objsBlockers
    .map((b) => String((b as RecordModel).description ?? '').trim())
    .filter(Boolean)
    .slice(0, 3)
  if (!parts.length) return '—'
  const text = parts.join('；')
  return text.length > 120 ? `${text.slice(0, 117)}…` : text
}

function priorityLabelFromPb(pb: string): ObjectiveListRow['priority'] {
  if (pb === 'P0' || pb === 'P1') return '高'
  if (pb === 'P2') return '中'
  return '低'
}

function pbPriorityRank(pb: string): number {
  if (pb === 'P0') return 0
  if (pb === 'P1') return 1
  if (pb === 'P2') return 2
  if (pb === 'P3') return 3
  return 99
}

function inferHealth(status: string, hasBlocker: boolean): ObjectiveListHealth {
  if (hasBlocker) return 'blocked'
  if (status === 'paused') return 'risk'
  return 'normal'
}

function formatObjectiveUpdated(updated: unknown): string {
  if (!updated) return '—'
  const d = new Date(String(updated))
  if (Number.isNaN(d.getTime())) return '—'
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function groupBlockersByObjective(blockers: RecordModel[]): Map<string, RecordModel[]> {
  const m = new Map<string, RecordModel[]>()
  for (const b of blockers) {
    const oid = b.objective
    if (typeof oid !== 'string' || !oid) continue
    const arr = m.get(oid) ?? []
    arr.push(b)
    m.set(oid, arr)
  }
  return m
}

function sparklineFromRecords(records: RecordModel[]): number[] {
  const sorted = [...records].sort((a, b) => {
    const ta = new Date(String(a.updated ?? 0)).getTime()
    const tb = new Date(String(b.updated ?? 0)).getTime()
    return tb - ta
  })
  const slice = sorted.slice(0, 7).reverse()
  const raw = slice.map((r) => clampPercent(r.progress_percent) / 100)
  while (raw.length < 7) {
    raw.push(raw[raw.length - 1] ?? 0.5)
  }
  return raw
}

function taskObjectiveId(record: RecordModel): string {
  const oid = record.objective
  return typeof oid === 'string' ? oid : String(oid ?? '')
}

function groupsTasksByObjective(records: RecordModel[]): Map<string, { total: number; done: number }> {
  const m = new Map<string, { total: number; done: number }>()
  for (const t of records) {
    const oid = taskObjectiveId(t)
    if (!oid) continue
    const prev = m.get(oid) ?? { total: 0, done: 0 }
    prev.total++
    if (String(t.status ?? '') === 'done') prev.done++
    m.set(oid, prev)
  }
  return m
}

function groupKeyResultsByObjective(records: RecordModel[]): Map<string, RecordModel[]> {
  const m = new Map<string, RecordModel[]>()
  for (const kr of records) {
    const oid = typeof kr.objective === 'string' ? kr.objective : String(kr.objective ?? '')
    if (!oid) continue
    const arr = m.get(oid) ?? []
    arr.push(kr)
    m.set(oid, arr)
  }
  return m
}

function recordToRow(
  record: RecordModel & { expand?: { owner?: RecordModel } },
  byObjBlockers: Map<string, RecordModel[]>,
  blockedIds: Set<string>,
  byObjKr: Map<string, RecordModel[]>,
  byObjTasks: Map<string, { total: number; done: number }>,
): ObjectiveListRow {
  const owner = record.expand?.owner
  const ownerId = typeof record.owner === 'string' ? record.owner : ''
  const ownerName = owner ? String(owner.name ?? '') : '—'
  const ownerTeam = owner ? String(owner.team ?? '') : ''
  const blockerList = byObjBlockers.get(record.id)
  const status = String(record.status ?? '')
  const hasBlocker = blockedIds.has(record.id)
  const health = inferHealth(status, hasBlocker)
  const pbPriority = String(record.priority ?? '')
  const nextActs = parseNextActions(record.next_actions)
  const firstNext = nextActs[0]

  const krs = byObjKr.get(record.id) ?? []
  const krAgg = krCompletionFromRows(krs.map((r) => ({ name: String(r.name ?? ''), is_completed: Boolean(r.is_completed) })))
  const taskPair = byObjTasks.get(record.id) ?? { total: 0, done: 0 }
  const blocker_items = blockerItemsSorted(blockerList)

  const progress_display_pct =
    krAgg.percent !== null ? clampPercent(krAgg.percent) : clampPercent(record.progress_percent)

  return {
    id: record.id,
    name: String(record.name ?? '—'),
    definition: editorToPlainText(String(record.definition ?? '')),
    progress_percent: clampPercent(record.progress_percent),
    progress_display_pct,
    kr_completed: krAgg.completed,
    kr_total: krAgg.total,
    kr_percent: krAgg.percent !== null ? clampPercent(krAgg.percent) : null,
    task_completed: taskPair.done,
    task_total: taskPair.total,
    health,
    priority: priorityLabelFromPb(pbPriority),
    owner_name: ownerName,
    owner_team: ownerTeam || '—',
    owner_initials: initialsFromName(ownerName || '?'),
    owner_color: ownerId ? ownerAvatarColor(ownerId) : '#94a3b8',
    blockers: blockersSummaryForObjective(blockerList),
    blockers_count: blockerList?.length ?? 0,
    blocker_items,
    next_action: firstNext?.suggestion?.trim() || '—',
    next_action_date: firstNext ? formatDotDate(firstNext.suggestion_date) : '—',
    updated_at: formatObjectiveUpdated(record.updated),
  }
}

function computeKpis(
  objectives: RecordModel[],
  blockedIds: Set<string>,
  highPriorityOpenTasksCount: number,
  byObjKr: Map<string, RecordModel[]>,
  totalBlockers: number,
  teamMembersCount: number,
): ObjectivesListKpi {
  const { label: period_label, range: period_range } = currentQuarterPeriod()
  const total = objectives.length
  const denomPct = Math.max(total, 1)

  let normal = 0
  let risk = 0
  for (let i = 0; i < objectives.length; i++) {
    const o = objectives[i]!
    const st = String(o.status ?? '')
    const h = inferHealth(st, blockedIds.has(o.id))
    if (h === 'normal') normal++
    else if (h === 'risk') risk++
  }

  const pct = (n: number) => Math.round((n / denomPct) * 100)

  const activeForAvg = objectives.filter((o) => String(o.status ?? '') !== 'cancelled')
  const pctValues: number[] = []
  for (const o of activeForAvg) {
    const krAgg = krCompletionFromRows((byObjKr.get(o.id) ?? []).map((r) => ({ name: String(r.name ?? ''), is_completed: Boolean(r.is_completed) })))
    if (krAgg.percent !== null) pctValues.push(krAgg.percent)
  }
  const avgKr = pctValues.length === 0 ? null : Math.round(pctValues.reduce((s, n) => s + n, 0) / pctValues.length)

  const avgProgress =
    activeForAvg.length === 0
      ? 0
      : activeForAvg.reduce((s, o) => {
          const krAgg = krCompletionFromRows((byObjKr.get(o.id) ?? []).map((r) => ({ name: String(r.name ?? ''), is_completed: Boolean(r.is_completed) })))
          const disp =
            krAgg.percent !== null
              ? clampPercent(krAgg.percent)
              : clampPercent(o.progress_percent)
          return s + disp
        }, 0) / activeForAvg.length

  let deltaSum = 0
  let deltaN = 0
  for (const o of activeForAvg) {
    const v = o.progress_delta_percent
    const num = typeof v === 'number' ? v : v != null && v !== '' ? Number(v) : NaN
    if (!Number.isNaN(num)) {
      deltaSum += num
      deltaN++
    }
  }
  const avgDelta = deltaN > 0 ? deltaSum / deltaN : null
  const avg_progress_delta =
    avgDelta == null ? '—' : `${avgDelta >= 0 ? '+' : ''}${Math.round(avgDelta)}%`

  /** Simple secondary hint: objectives at risk vs last week N/A → show proportion of 「风险」targets */
  const riskHint = risk > 0 ? `${risk} 个风险` : '稳定'

  let blocked_objectives_count = 0
  let active_objectives_count = 0
  for (const o of objectives) {
    const st = String(o.status ?? '')
    if (st !== 'done' && st !== 'cancelled') active_objectives_count++
    if (blockedIds.has(o.id)) blocked_objectives_count++
  }

  return {
    period_label,
    period_range,
    total_goals: total,
    normal_goals: { count: normal, pct: pct(normal) },
    risk_goals: { count: risk, pct: pct(risk) },
    high_priority_tasks: {
      count: highPriorityOpenTasksCount,
      delta: riskHint,
    },
    avg_kr_completion_pct: avgKr,
    avg_progress_pct: Math.round(avgProgress),
    avg_progress_delta,
    active_objectives_count,
    blocked_objectives_count,
    total_blockers: totalBlockers,
    team_members_count: teamMembersCount,
  }
}

/**
 * Loads all objectives (with owners), blocker summaries, task KPI snippet, for `/objectives` list page.
 */
export async function fetchObjectivesList(): Promise<ObjectivesListPayload> {
  const req = `objectives_list_${Date.now()}`
  const [objectiveRecords, blockerRecords, taskRecords, krRecordsMaybe, memberRecords] = await Promise.all([
    pb.collection('objectives').getFullList({
      expand: 'owner',
      sort: '-priority,name',
      requestKey: `${req}_o`,
      batch: 500,
    }),
    pb.collection('blockers').getFullList({
      requestKey: `${req}_b`,
      batch: 400,
    }),
    pb.collection('tasks').getFullList({
      batch: 500,
      fields: 'id,objective,status,priority',
      requestKey: `${req}_t`,
    }),
    pb.collection('key_results').getFullList({
      batch: 500,
      fields: 'id,objective,name,is_completed,sort_order',
      requestKey: `${req}_kr`,
    }).catch(() => [] as RecordModel[]),
    pb.collection('members')
      .getFullList({
        batch: 500,
        fields: 'id',
        requestKey: `${req}_m`,
      })
      .catch(() => [] as RecordModel[]),
  ])

  const highPriTasks = taskRecords.filter(
    (t) => (String(t.priority ?? '') === 'P0' || String(t.priority ?? '') === 'P1') && String(t.status ?? '') !== 'done',
  )

  const blockedIds = blockedObjectiveIdsFrom(blockerRecords)
  const byObj = groupBlockersByObjective(blockerRecords)
  const byObjKr = groupKeyResultsByObjective(krRecordsMaybe)
  const byObjTasks = groupsTasksByObjective(taskRecords)

  const sortedObjectives = [...objectiveRecords].sort(
    (a, b) =>
      pbPriorityRank(String(a.priority ?? '')) - pbPriorityRank(String(b.priority ?? '')) ||
      String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-CN'),
  )

  const rows = sortedObjectives.map((rec) =>
    recordToRow(
      rec as RecordModel & { expand?: { owner?: RecordModel } },
      byObj,
      blockedIds,
      byObjKr,
      byObjTasks,
    ),
  )

  const kpis = computeKpis(
    objectiveRecords,
    blockedIds,
    highPriTasks.length,
    byObjKr,
    blockerRecords.length,
    memberRecords.length,
  )
  const sparkline_points = sparklineFromRecords(objectiveRecords)

  return {
    rows,
    kpis,
    sparkline_points,
  }
}
