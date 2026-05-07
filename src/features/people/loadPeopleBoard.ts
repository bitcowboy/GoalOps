import type { RecordModel } from 'pocketbase'
import { initialsFromName } from '@/features/objectives/objectiveDetailUtils'
import { objectiveDotColor } from '@/features/tasks/loadTasksBoard'
import { pb } from '@/services/pocketbase'
import type { PeopleRiskStatus, PeopleWeeklyDayLoad } from '@/features/people/peopleUtils'
import {
  memberAvatarColor,
  round1,
  safePercent,
  syntheticWeeklyLoads,
  utilizationRisk,
} from '@/features/people/peopleUtils'

export type PeopleBoardRow = {
  memberId: string
  name: string
  role: string
  team: string
  initials: string
  avatarColor: string
  mainObjectiveId: string
  mainObjectiveName: string
  mainObjectiveProgress: number
  mainObjectiveDotColor: string
  activeTaskCount: number
  hoursObjectiveWork: number
  hoursMeeting: number
  hoursMisc: number
  utilizationPercent: number
  weeklyDots: PeopleWeeklyDayLoad[]
  risk: PeopleRiskStatus
}

export type PeopleInsightKind =
  | 'personnel_overload'
  | 'meeting_overload'
  | 'multi_objective'
  | 'key_personnel'

export type PeopleInsightMemberSample = {
  id: string
  name: string
  initials: string
  color: string
}

export type PeopleInsightCard = {
  kind: PeopleInsightKind
  title: string
  /** e.g. "6人 · 占比 25%" */
  countLabel: string
  description: string
  members: PeopleInsightMemberSample[]
}

export type PeopleBoardKpis = {
  teamSize: number
  avgUtilization: number
  overloadedCount: number
  overloadedPct: number
  criticalPathOwnersCount: number
  criticalPathOwnersPct: number
  weeklyMeetingHoursTotal: number
}

export type PeopleBoardPayload = {
  rows: PeopleBoardRow[]
  kpis: PeopleBoardKpis
  insights: PeopleInsightCard[]
}

function num(record: RecordModel, key: string): number {
  const v = record[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function str(record: RecordModel, key: string): string {
  const v = record[key]
  return v == null ? '' : String(v).trim()
}

function relationId(raw: unknown): string {
  if (typeof raw === 'string') return raw
  return ''
}

function isActiveTask(status: string): boolean {
  return status !== '' && status !== 'done'
}

function priorityRank(p: string): number {
  if (p === 'P0') return 0
  if (p === 'P1') return 1
  if (p === 'P2') return 2
  return 3
}

function estimateHours(record: RecordModel): number {
  const n = num(record, 'estimate_hours')
  return Math.max(0, n)
}

function buildObjectiveMap(objectives: RecordModel[]): Map<string, RecordModel> {
  const m = new Map<string, RecordModel>()
  for (const o of objectives) m.set(o.id, o)
  return m
}

/**
 * Loads members, tasks, objectives, misc_work and aggregates utilisation metrics for `/people`.
 */
export async function fetchPeopleBoard(): Promise<PeopleBoardPayload> {
  const req = `people_board_${Date.now()}`
  const [memberRecords, taskRecordsRaw, objectiveRecordsRaw, miscRecordsRaw] = await Promise.all([
    pb.collection('members').getFullList({ sort: 'name', requestKey: `${req}_m`, batch: 500 }),
    pb.collection('tasks').getFullList({
      expand: 'objective,assignee',
      requestKey: `${req}_t`,
      batch: 500,
    }),
    pb.collection('objectives').getFullList({
      sort: '-priority,name',
      requestKey: `${req}_o`,
      batch: 500,
    }),
    pb
      .collection('misc_work')
      .getFullList({ expand: 'member', requestKey: `${req}_w`, batch: 500 })
      .catch(() => [] as RecordModel[]),
  ])

  const taskRecords = taskRecordsRaw as RecordModel[]
  const objectiveById = buildObjectiveMap(objectiveRecordsRaw as RecordModel[])

  /** hours from non-done tasks per member → per objective id */
  const taskHoursByMember = new Map<string, Map<string, number>>()
  const taskCountsByMember = new Map<string, number>()

  for (const t of taskRecords) {
    const assigneeId = relationId(t.assignee)
    if (!assigneeId) continue
    const st = str(t, 'status')
    if (!isActiveTask(st)) continue
    const oid = relationId(t.objective)
    const h = estimateHours(t)
    if (!taskHoursByMember.has(assigneeId)) taskHoursByMember.set(assigneeId, new Map())
    const inner = taskHoursByMember.get(assigneeId)!
    inner.set(oid, (inner.get(oid) ?? 0) + h)
    taskCountsByMember.set(assigneeId, (taskCountsByMember.get(assigneeId) ?? 0) + 1)
  }

  const meetingHoursByMember = new Map<string, number>()
  const miscHoursByMember = new Map<string, number>()
  for (const w of miscRecordsRaw as RecordModel[]) {
    const mid = relationId(w.member)
    if (!mid) continue
    const kind = str(w, 'kind')
    const h = Math.max(0, num(w, 'hours'))
    if (kind === 'meeting') {
      meetingHoursByMember.set(mid, (meetingHoursByMember.get(mid) ?? 0) + h)
    } else {
      miscHoursByMember.set(mid, (miscHoursByMember.get(mid) ?? 0) + h)
    }
  }

  let weeklyMeetingHoursTotal = 0
  for (const [, h] of meetingHoursByMember) weeklyMeetingHoursTotal += h

  /** 关键路径负责人：P0 未完成目标负责人，或处于风险中的 P1 目标负责人 */
  const criticalOwnerIds = new Set<string>()
  for (const o of objectiveRecordsRaw as RecordModel[]) {
    const st = str(o, 'status')
    const pr = str(o, 'priority')
    if (st === 'done' || st === 'cancelled') continue
    const owner = relationId(o.owner)
    if (!owner) continue
    if (pr === 'P0' || (pr === 'P1' && st === 'at_risk')) criticalOwnerIds.add(owner)
  }

  const rows: PeopleBoardRow[] = []
  let overloadedCount = 0

  for (const m of memberRecords as RecordModel[]) {
    const memberId = m.id
    const name = str(m, 'name') || '—'
    const weeklyAvailable = Math.max(0, Math.round(num(m, 'weekly_available_hours')) || 40)

    const hoursObjectiveWork = round1(
      Array.from(taskHoursByMember.get(memberId)?.values() ?? []).reduce((a, b) => a + b, 0),
    )
    const hoursMeeting = round1(meetingHoursByMember.get(memberId) ?? 0)
    const hoursMisc = round1(miscHoursByMember.get(memberId) ?? 0)

    const totalAllocated = round1(hoursObjectiveWork + hoursMeeting + hoursMisc)
    const utilizationPercent =
      weeklyAvailable <= 0 ? (totalAllocated > 0 ? 999 : 0) : Math.round((totalAllocated / weeklyAvailable) * 100)

    const activeTaskCount = taskCountsByMember.get(memberId) ?? 0

    /** 主目标：未完成任务的估算工时最多的目标；若没有任务则取担任 owner 的最高优先级未完成目标 */
    let mainObjectiveId = ''
    let mainObjectiveProgress = 0
    let mainObjectiveName = '—'

    const perObj = taskHoursByMember.get(memberId)
    if (perObj && perObj.size) {
      let bestOid = ''
      let bestHours = -1
      for (const [oid, hrs] of perObj) {
        if (hrs > bestHours || (hrs === bestHours && oid.localeCompare(bestOid) < 0)) {
          bestHours = hrs
          bestOid = oid
        }
      }
      if (bestOid) {
        const obj = objectiveById.get(bestOid)
        mainObjectiveId = bestOid
        mainObjectiveName = obj ? str(obj, 'name') : `目标 ${bestOid.slice(0, 8)}…`
        mainObjectiveProgress = obj ? Math.round(num(obj, 'progress_percent')) : 0
      }
    } else {
      const owned = (objectiveRecordsRaw as RecordModel[]).filter(
        (o) => relationId(o.owner) === memberId && str(o, 'status') !== 'done' && str(o, 'status') !== 'cancelled',
      )
      owned.sort((a, b) => priorityRank(str(a, 'priority')) - priorityRank(str(b, 'priority')))
      const obj = owned[0]
      if (obj) {
        mainObjectiveId = obj.id
        mainObjectiveName = str(obj, 'name')
        mainObjectiveProgress = Math.round(num(obj, 'progress_percent'))
      }
    }

    const risk = utilizationRisk(utilizationPercent)
    if (utilizationPercent > 100) overloadedCount++

    rows.push({
      memberId,
      name,
      role: str(m, 'role') || '—',
      team: str(m, 'team') || '—',
      initials: initialsFromName(name),
      avatarColor: memberAvatarColor(memberId),
      mainObjectiveId,
      mainObjectiveName,
      mainObjectiveProgress,
      mainObjectiveDotColor: mainObjectiveId ? objectiveDotColor(mainObjectiveId) : '#94a3b8',
      activeTaskCount,
      hoursObjectiveWork,
      hoursMeeting,
      hoursMisc,
      utilizationPercent,
      weeklyDots: syntheticWeeklyLoads(memberId, utilizationPercent),
      risk,
    })
  }

  const teamSize = rows.length
  const avgUtilization =
    teamSize === 0 ? 0 : Math.round(rows.reduce((a, r) => a + Math.min(r.utilizationPercent, 200), 0) / teamSize)

  const kpis: PeopleBoardKpis = {
    teamSize,
    avgUtilization,
    overloadedCount,
    overloadedPct: safePercent(overloadedCount, teamSize),
    criticalPathOwnersCount: criticalOwnerIds.size,
    criticalPathOwnersPct: safePercent(criticalOwnerIds.size, teamSize),
    weeklyMeetingHoursTotal: round1(weeklyMeetingHoursTotal),
  }

  const overloadMembers = rows.filter((r) => r.risk === 'overload')
  const meetingOverloadMembers = rows.filter((r) => {
    const t = round1(r.hoursObjectiveWork + r.hoursMeeting + r.hoursMisc)
    return t > 0 && r.hoursMeeting / t > 0.4
  })

  const multiObjMembers = rows.filter((r) => {
    const oidSet = new Set<string>()
    for (const t of taskRecords) {
      if (relationId(t.assignee) !== r.memberId) continue
      const st = str(t, 'status')
      if (!isActiveTask(st)) continue
      const oid = relationId(t.objective)
      if (oid) oidSet.add(oid)
    }
    return oidSet.size >= 3
  })

  const keyRiskMembers = rows.filter(
    (r) => criticalOwnerIds.has(r.memberId) && (r.utilizationPercent > 100 || r.utilizationPercent >= 90),
  )

  const sampleCap = 6

  const toSamples = (list: PeopleBoardRow[]): PeopleInsightMemberSample[] =>
    list.slice(0, sampleCap).map((r) => ({
      id: r.memberId,
      name: r.name,
      initials: r.initials,
      color: r.avatarColor,
    }))

  const insights: PeopleInsightCard[] = [
    {
      kind: 'personnel_overload',
      title: '人员过载',
      countLabel: `${overloadMembers.length}人 · 占比 ${safePercent(overloadMembers.length, teamSize)}%`,
      description: '占用率超过 100%，存在交付风险',
      members: toSamples(overloadMembers.sort((a, b) => b.utilizationPercent - a.utilizationPercent)),
    },
    {
      kind: 'meeting_overload',
      title: '会议过载',
      countLabel: `${meetingOverloadMembers.length}人 · 占比 ${safePercent(meetingOverloadMembers.length, teamSize)}%`,
      description: '会议时间超过 40%，影响专注时间',
      members: toSamples(meetingOverloadMembers.sort((a, b) => b.hoursMeeting - a.hoursMeeting)),
    },
    {
      kind: 'multi_objective',
      title: '多目标分散',
      countLabel: `${multiObjMembers.length}人 · 占比 ${safePercent(multiObjMembers.length, teamSize)}%`,
      description: '同时参与 ≥ 3 个目标，效率受影响',
      members: toSamples(multiObjMembers.sort((a, b) => b.activeTaskCount - a.activeTaskCount)),
    },
    {
      kind: 'key_personnel',
      title: '关键人员风险',
      countLabel: `${keyRiskMembers.length}人 · 占比 ${safePercent(keyRiskMembers.length, teamSize)}%`,
      description: '关键路径负责人过载或单点依赖',
      members: toSamples(keyRiskMembers.sort((a, b) => b.utilizationPercent - a.utilizationPercent)),
    },
  ]

  return { rows, kpis, insights }
}
