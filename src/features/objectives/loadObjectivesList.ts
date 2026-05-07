import type { RecordModel } from 'pocketbase'
import {
  clampPercent,
  editorToPlainText,
  formatDotDate,
  initialsFromName,
  parseNextActions,
} from '@/features/objectives/objectiveDetailUtils'
import { pb } from '@/services/pocketbase'

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
}

export type ObjectivesListKpi = {
  period_label: string
  period_range: string
  total_goals: number
  normal_goals: { count: number; pct: number }
  risk_goals: { count: number; pct: number }
  high_priority_tasks: { count: number; delta: string }
  avg_progress_pct: number
  avg_progress_delta: string
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

function recordToRow(
  record: RecordModel & { expand?: { owner?: RecordModel } },
  byObjBlockers: Map<string, RecordModel[]>,
  blockedIds: Set<string>,
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

  return {
    id: record.id,
    name: String(record.name ?? '—'),
    definition: editorToPlainText(String(record.definition ?? '')),
    progress_percent: clampPercent(record.progress_percent),
    health,
    priority: priorityLabelFromPb(pbPriority),
    owner_name: ownerName,
    owner_team: ownerTeam || '—',
    owner_initials: initialsFromName(ownerName || '?'),
    owner_color: ownerId ? ownerAvatarColor(ownerId) : '#94a3b8',
    blockers: blockersSummaryForObjective(blockerList),
    next_action: firstNext?.suggestion?.trim() || '—',
    next_action_date: firstNext ? formatDotDate(firstNext.suggestion_date) : '—',
    updated_at: formatObjectiveUpdated(record.updated),
  }
}

function computeKpis(
  objectives: RecordModel[],
  blockedIds: Set<string>,
  highPriorityOpenTasksCount: number,
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
  const avgProgress =
    activeForAvg.length === 0
      ? 0
      : activeForAvg.reduce((s, o) => s + clampPercent(o.progress_percent), 0) / activeForAvg.length

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
    avg_progress_pct: Math.round(avgProgress),
    avg_progress_delta,
  }
}

/**
 * Loads all objectives (with owners), blocker summaries, task KPI snippet, for `/objectives` list page.
 */
export async function fetchObjectivesList(): Promise<ObjectivesListPayload> {
  const req = `objectives_list_${Date.now()}`
  const [objectiveRecords, blockerRecords, highPriTasks] = await Promise.all([
    pb.collection('objectives').getFullList({
      expand: 'owner',
      // `updated` is not a valid sort column in this project's PB rules; match `fetchPeopleBoard`.
      sort: '-priority,name',
      requestKey: `${req}_o`,
      batch: 500,
    }),
    pb.collection('blockers').getFullList({
      requestKey: `${req}_b`,
      batch: 400,
    }),
    pb.collection('tasks').getFullList({
      filter: '(priority = "P0" || priority = "P1") && status != "done"',
      requestKey: `${req}_hp`,
      batch: 400,
      fields: 'id',
    }),
  ])

  const blockedIds = blockedObjectiveIdsFrom(blockerRecords)
  const byObj = groupBlockersByObjective(blockerRecords)

  const sortedObjectives = [...objectiveRecords].sort(
    (a, b) =>
      pbPriorityRank(String(a.priority ?? '')) - pbPriorityRank(String(b.priority ?? '')) ||
      String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-CN'),
  )

  const rows = sortedObjectives.map((rec) =>
    recordToRow(rec as RecordModel & { expand?: { owner?: RecordModel } }, byObj, blockedIds),
  )

  const kpis = computeKpis(objectiveRecords, blockedIds, highPriTasks.length)
  const sparkline_points = sparklineFromRecords(objectiveRecords)

  return {
    rows,
    kpis,
    sparkline_points,
  }
}
