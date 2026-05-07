import type { RecordModel } from 'pocketbase'
import {
  initialsFromName,
  parseStringArray,
  taskStatusLabel,
} from '@/features/objectives/objectiveDetailUtils'
import { pb } from '@/services/pocketbase'

export type TaskRiskLevel = 'normal' | 'risk' | 'high'

/** One table row derived from PocketBase `tasks` + expands. */
export type TaskListRow = {
  id: string
  /** Raw PocketBase task status (`pending`, `in_progress`, …). */
  pbStatus: string
  objectiveId: string
  objectiveName: string
  objectiveDotColor: string
  title: string
  assigneeId: string
  assigneeName: string
  assigneeInitials: string
  assigneeAvatarColor: string
  prerequisiteLabel: string | null
  /** P0–P3 */
  priority: string
  /** `YYYY-MM-DD` or '' */
  dueIso: string
  estimatedHours: number
  risk: TaskRiskLevel
  objectiveHasBlocker: boolean
}

export type TasksBoardKpis = {
  total: number
  in_progress: { count: number; pct: number }
  pending_review: { count: number; pct: number }
  blocked: { count: number; pct: number }
  due_this_week: { count: number }
}

export type TaskHealthSlices = {
  normal: { count: number; label: string; pct: number }
  risk: { count: number; label: string; pct: number }
  blocked: { count: number; label: string; pct: number }
  not_started: { count: number; label: string; pct: number }
}

export type DependencyRiskAlertRow = {
  id: string
  level: 'critical' | 'warning'
  taskTitle: string
  dependencyNote: string
  blockedForLabel: string
}

const OBJECTIVE_DOT_PALETTE = ['#7c3aed', '#2563eb', '#059669', '#ea580c', '#0891b2', '#c026d3'] as const
const ASSIGNEE_DOT_PALETTE = ['#64748b', '#7c3aed', '#2563eb', '#059669', '#ea580c', '#0d9488'] as const

function hashBucket(id: string, mod: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % mod
}

export function objectiveDotColor(objectiveId: string): string {
  return OBJECTIVE_DOT_PALETTE[hashBucket(objectiveId, OBJECTIVE_DOT_PALETTE.length)]!
}

function memberDotColor(memberId: string): string {
  return ASSIGNEE_DOT_PALETTE[hashBucket(memberId, ASSIGNEE_DOT_PALETTE.length)]!
}

export function predecessorIds(raw: unknown): string[] {
  return parseStringArray(raw)
}

function todayIsoLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeekMondayIsoLocal(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const y = monday.getFullYear()
  const m = `${monday.getMonth() + 1}`.padStart(2, '0')
  const dd = `${monday.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function endOfWeekSundayIsoLocal(): string {
  const mon = startOfWeekMondayIsoLocal()
  const md = new Date(`${mon}T12:00:00`)
  const sun = new Date(md)
  sun.setDate(md.getDate() + 6)
  const y = sun.getFullYear()
  const m = `${sun.getMonth() + 1}`.padStart(2, '0')
  const dd = `${sun.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function isDueThisWeek(iso: string): boolean {
  if (!iso) return false
  const start = startOfWeekMondayIsoLocal()
  const end = endOfWeekSundayIsoLocal()
  return iso >= start && iso <= end
}

function taskDueIso(record: RecordModel): string {
  const raw = record.due_date
  if (raw == null || raw === '') return ''
  const s = String(raw)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function isOverdue(dueIso: string): boolean {
  if (!dueIso) return false
  return dueIso < todayIsoLocal()
}

function inferRisk(
  pbStatus: string,
  priority: string,
  dueIso: string,
  objectiveHasBlocker: boolean,
): TaskRiskLevel {
  if (objectiveHasBlocker && pbStatus !== 'done') return pbStatus === 'review' ? 'high' : 'risk'
  if ((priority === 'P0' || priority === 'P1') && isOverdue(dueIso) && pbStatus !== 'done') return 'high'
  if (isOverdue(dueIso) && pbStatus !== 'done') return 'risk'
  if (pbStatus === 'review' && priority === 'P0') return 'risk'
  return 'normal'
}

export type HealthSliceKey = keyof TaskHealthSlices

export function classifyHealthSlice(row: TaskListRow): HealthSliceKey {
  if (row.pbStatus === 'done') return 'normal'
  if (row.pbStatus === 'pending') return 'not_started'
  if (row.objectiveHasBlocker && row.pbStatus !== 'done') return 'blocked'
  if (row.pbStatus === 'review' || isOverdue(row.dueIso)) return 'risk'
  return 'normal'
}

export function computeTaskKpis(rows: TaskListRow[]): TasksBoardKpis {
  const total = rows.length
  const denom = Math.max(total, 1)
  const inProgress = rows.filter((r) => r.pbStatus === 'in_progress').length
  const review = rows.filter((r) => r.pbStatus === 'review').length
  /** Tasks on objectives that have an open blocker (see `computeBlockedObjectiveIds`). */
  const blocked = rows.filter((r) => r.objectiveHasBlocker && r.pbStatus !== 'done').length
  const dueWeek = rows.filter((r) => r.pbStatus !== 'done' && isDueThisWeek(r.dueIso)).length
  const pct = (n: number) => Math.round((n / denom) * 100)
  return {
    total,
    in_progress: { count: inProgress, pct: pct(inProgress) },
    pending_review: { count: review, pct: pct(review) },
    blocked: { count: blocked, pct: pct(blocked) },
    due_this_week: { count: dueWeek },
  }
}

export function computeHealthSlices(rows: TaskListRow[]): TaskHealthSlices {
  const keys: HealthSliceKey[] = []
  for (const r of rows) keys.push(classifyHealthSlice(r))
  const tally = {
    normal: 0,
    risk: 0,
    blocked: 0,
    not_started: 0,
  }
  for (const k of keys) tally[k]++
  const total = rows.length
  const denom = Math.max(total, 1)
  const pct = (n: number) => Math.round((n / denom) * 100)
  return {
    normal: { count: tally.normal, label: '正常', pct: pct(tally.normal) },
    risk: { count: tally.risk, label: '风险', pct: pct(tally.risk) },
    blocked: { count: tally.blocked, label: '阻塞', pct: pct(tally.blocked) },
    not_started: { count: tally.not_started, label: '未开始', pct: pct(tally.not_started) },
  }
}

/** Objective ids referenced by at least one blocker record. */
function computeBlockedObjectiveIds(blockers: RecordModel[]): Set<string> {
  const s = new Set<string>()
  for (const b of blockers) {
    const oid = b.objective
    if (typeof oid === 'string' && oid) s.add(oid)
  }
  return s
}

export function buildTitleByTaskId(records: RecordModel[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const t of records) m.set(t.id, String(t.title ?? ''))
  return m
}

/** First unfinished predecessor → label for 「前置依赖未完成」风险提示。 */
export function computeDependencyAlerts(
  records: RecordModel[],
  titles: Map<string, string>,
): DependencyRiskAlertRow[] {
  const byId = new Map(records.map((r) => [r.id, r]))
  const out: DependencyRiskAlertRow[] = []
  const statusRank = (st: string) => (st === 'done' ? 1 : 0)

  for (const t of records) {
    const preds = predecessorIds(t.predecessor_ids)
    if (!preds.length) continue
    let blockedBy: string | null = null
    for (const pid of preds) {
      const pred = byId.get(pid)
      if (!pred) {
        blockedBy = `前置任务缺失（${pid.slice(0, 8)}…）`
        break
      }
      const pst = String(pred.status ?? '')
      if (pst !== 'done') {
        const tn = titles.get(pid) ?? '前置任务'
        blockedBy = `等待：「${tn}」（${taskStatusLabel(pst)}）`
        break
      }
    }
    if (!blockedBy) continue
    const mine = statusRank(String(t.status ?? ''))
    out.push({
      id: `dep-${t.id}`,
      level: mine === 0 ? 'critical' : 'warning',
      taskTitle: String(t.title ?? ''),
      dependencyNote: blockedBy,
      blockedForLabel: '依赖未完成',
    })
    if (out.length >= 5) break
  }
  return out.slice(0, 3)
}

export function recordToTaskListRow(
  record: RecordModel & { expand?: { assignee?: RecordModel; objective?: RecordModel } },
  titles: Map<string, string>,
  blockedObjectiveIds: Set<string>,
): TaskListRow {
  const objective = record.expand?.objective as RecordModel | undefined
  const assignee = record.expand?.assignee as RecordModel | undefined
  const objectiveId = typeof record.objective === 'string' ? record.objective : String(record.objective ?? '')
  const objectiveName = objective ? String(objective.name ?? '') : objectiveId ? `目标 ${objectiveId.slice(0, 8)}…` : '—'
  const assigneeId = typeof record.assignee === 'string' ? record.assignee : String(record.assignee ?? '')
  const unassigned = !assigneeId
  const assigneeName = unassigned ? '未分配' : assignee ? String(assignee.name ?? '') : '—'

  const assigneeInitials = unassigned ? '—' : initialsFromName(assigneeName)

  const pbStatus = String(record.status ?? 'pending')
  const priority = String(record.priority ?? 'P3')
  const dueIso = taskDueIso(record)
  const est = typeof record.estimate_hours === 'number' ? record.estimate_hours : Number(record.estimate_hours ?? 0) || 0
  const preds = predecessorIds(record.predecessor_ids)
  const firstPredTitle = preds.length ? titles.get(preds[0]!) ?? `前置 ${preds.length} 项` : null

  const objectiveHasBlocker = !!(objectiveId && blockedObjectiveIds.has(objectiveId))

  const row: TaskListRow = {
    id: record.id,
    pbStatus,
    objectiveId,
    objectiveName,
    objectiveDotColor: objectiveId ? objectiveDotColor(objectiveId) : '#94a3b8',
    title: String(record.title ?? ''),
    assigneeId,
    assigneeName,
    assigneeInitials,
    assigneeAvatarColor: assigneeId ? memberDotColor(assigneeId) : '#94a3b8',
    prerequisiteLabel: firstPredTitle,
    priority,
    dueIso,
    estimatedHours: est,
    risk: inferRisk(pbStatus, priority, dueIso, objectiveHasBlocker),
    objectiveHasBlocker,
  }
  return row
}

export type TasksBoardPayload = {
  rows: TaskListRow[]
  members: RecordModel[]
  objectives: RecordModel[]
  kpis: TasksBoardKpis
  healthSlices: TaskHealthSlices
  dependencyAlerts: DependencyRiskAlertRow[]
}

/**
 * Loads all tasks + related data for `/tasks`.
 * Prefer expand `assignee,objective` on tasks; fallback objective name via empty expand is weak but handled.
 */
export async function fetchTasksBoard(): Promise<TasksBoardPayload> {
  const req = `tasks_board_${Date.now()}`
  const [taskRecordsRaw, blockerRecordsRaw, memberRecordsRaw, objectiveRecordsRaw] = await Promise.all([
    pb.collection('tasks').getFullList({
      expand: 'assignee,objective',
      sort: 'due_date',
      requestKey: `${req}_t`,
    }),
    pb.collection('blockers').getFullList({
      requestKey: `${req}_b`,
      batch: 200,
    }),
    pb.collection('members').getFullList({
      sort: 'name',
      requestKey: `${req}_m`,
      batch: 500,
    }),
    pb.collection('objectives').getFullList({
      sort: 'name',
      requestKey: `${req}_o`,
      batch: 500,
    }),
  ])

  const blockedObjectiveIds = computeBlockedObjectiveIds(blockerRecordsRaw)
  const titles = buildTitleByTaskId(taskRecordsRaw)
  const rows = taskRecordsRaw.map((r) =>
    recordToTaskListRow(
      r as RecordModel & { expand?: { assignee?: RecordModel; objective?: RecordModel } },
      titles,
      blockedObjectiveIds,
    ),
  )

  const kpis = computeTaskKpis(rows)
  const healthSlices = computeHealthSlices(rows)
  const dependencyAlerts = computeDependencyAlerts(taskRecordsRaw, titles)

  return {
    rows,
    members: memberRecordsRaw,
    objectives: objectiveRecordsRaw,
    kpis,
    healthSlices,
    dependencyAlerts,
  }
}
