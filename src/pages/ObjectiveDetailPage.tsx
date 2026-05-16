import type { RecordModel } from 'pocketbase'
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { ObjectiveDetailView } from '@/features/objectives'
import { clampPercent } from '@/features/objectives/objectiveDetailUtils'
import { recomputeObjectiveProgressFromKeyResults } from '@/features/objectives/createObjective'
import { ParticipantsForm } from '@/features/objectives/ParticipantsForm'
import { KRForm } from '@/features/keyResults'
import { pb } from '@/services/pocketbase'

type DetailLocationState = { objectiveUpdated?: boolean }

/** 目标详情 — 对应 PRD `/objectives/:id` */
export function ObjectiveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [updateBanner, setUpdateBanner] = useState(false)
  const [objective, setObjective] = useState<(RecordModel & { expand?: { owner?: RecordModel } }) | null>(null)
  const [tasks, setTasks] = useState<RecordModel[]>([])
  const [blockers, setBlockers] = useState<RecordModel[]>([])
  const [keyResults, setKeyResults] = useState<RecordModel[]>([])
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([])
  const [keyResultBusyId, setKeyResultBusyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  /** KR modal state. `kr === null` 表示新建；`kr === RecordModel` 表示编辑 */
  const [krFormOpen, setKrFormOpen] = useState<{ kr: RecordModel | null } | null>(null)
  const [participantsOpen, setParticipantsOpen] = useState(false)

  const loadDetail = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return
      const silent = Boolean(opts?.silent)
      if (!silent) setLoading(true)
      try {
        const [obj, taskList, blkList, krList, memberList] = await Promise.all([
          pb.collection('objectives').getOne(id, { expand: 'owner' }),
          pb.collection('tasks').getFullList({
            filter: `objective="${id}"`,
            expand: 'assignee,key_result',
            sort: 'due_date',
          }),
          pb.collection('blockers').getFullList({
            filter: `objective="${id}"`,
            expand: 'owner',
          }),
          pb.collection('key_results').getFullList({
            filter: `objective="${id}"`,
            expand: 'owner',
            sort: 'sort_order,name',
          }),
          pb.collection('members').getFullList({
            sort: 'name',
            batch: 500,
          }),
        ])

        const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
        blkList.sort(
          (a, b) =>
            (severityRank[String(a.severity ?? '')] ?? 99) - (severityRank[String(b.severity ?? '')] ?? 99),
        )

        setObjective(obj as RecordModel & { expand?: { owner?: RecordModel } })
        setTasks(taskList)
        setBlockers(blkList)
        setKeyResults(krList)
        setMembers(
          memberList.map((m) => ({
            id: m.id,
            name: String(m.name ?? ''),
          })),
        )
        setError(null)
      } catch (e) {
        setObjective(null)
        setTasks([])
        setBlockers([])
        setKeyResults([])
        setMembers([])
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    queueMicrotask(() => void loadDetail({ silent: false }))
  }, [loadDetail])

  useEffect(() => {
    queueMicrotask(() => {
      const st = location.state as DetailLocationState | undefined
      if (st?.objectiveUpdated) {
        setUpdateBanner(true)
        navigate(location.pathname, { replace: true, state: {} })
      }
    })
  }, [location.pathname, location.state, navigate])

  const onToggleKeyResult = useCallback(
    async (krId: string, nextChecked: boolean) => {
      if (!id) return
      setKeyResultBusyId(krId)
      try {
        await pb.collection('key_results').update(krId, { is_completed: nextChecked })
        const pct = await recomputeObjectiveProgressFromKeyResults(id)
        if (pct !== null) {
          await pb.collection('objectives').update(id, { progress_percent: clampPercent(pct) })
        }
        await loadDetail({ silent: true })
      } finally {
        setKeyResultBusyId(null)
      }
    },
    [id, loadDetail],
  )

  const onCreateKeyResult = useCallback(() => {
    setKrFormOpen({ kr: null })
  }, [])

  const onEditKeyResult = useCallback((kr: RecordModel) => {
    setKrFormOpen({ kr })
  }, [])

  const onEditParticipants = useCallback(() => {
    setParticipantsOpen(true)
  }, [])

  const afterKRChange = useCallback(async () => {
    setKrFormOpen(null)
    if (!id) return
    // 关闭后异步刷新 + 同步 objective 进度
    const pct = await recomputeObjectiveProgressFromKeyResults(id)
    if (pct !== null) {
      try {
        await pb.collection('objectives').update(id, { progress_percent: clampPercent(pct) })
      } catch {
        /* 忽略：进度同步失败不阻塞 UI */
      }
    }
    await loadDetail({ silent: true })
  }, [id, loadDetail])

  const onDelete = useCallback(async () => {
    if (!id || !objective) return
    const name = String(objective.name ?? '')
    const ok = window.confirm(
      `确定删除目标「${name}」吗？\n\n该操作会级联删除目标下的任务、关键结果、卡点、交付物与核心文档，且不可恢复。`,
    )
    if (!ok) return
    setDeleting(true)
    try {
      await pb.collection('objectives').delete(id)
      navigate('/objectives', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDeleting(false)
    }
  }, [id, objective, navigate])

  if (!id) {
    return (
      <p className="text-sm text-[var(--goalops-warning)]" role="alert">
        路由缺少目标 ID。
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {updateBanner ? (
        <div
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--goalops-success)]/35 bg-[var(--goalops-success-soft)] px-4 py-3 text-sm font-medium text-[var(--goalops-success)]"
          role="status"
        >
          <span>目标已保存。</span>
          <button
            type="button"
            onClick={() => setUpdateBanner(false)}
            className="shrink-0 text-[var(--goalops-success)] underline decoration-[var(--goalops-success)]/50 underline-offset-2 hover:decoration-current"
          >
            关闭
          </button>
        </div>
      ) : null}
      {loading && <p className="text-sm text-[var(--goalops-text-muted)]">加载中…</p>}
      {error && (
        <p className="text-sm text-[var(--goalops-danger)]" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && objective ? (
        <ObjectiveDetailView
          objective={objective}
          tasks={tasks}
          blockers={blockers}
          keyResults={keyResults}
          members={members}
          onToggleKeyResult={onToggleKeyResult}
          keyResultBusyId={keyResultBusyId}
          onCreateKeyResult={onCreateKeyResult}
          onEditKeyResult={onEditKeyResult}
          onEditParticipants={onEditParticipants}
          onDelete={onDelete}
          deleting={deleting}
        />
      ) : null}

      {krFormOpen ? (
        <KRForm
          objectiveId={id}
          members={members}
          existing={krFormOpen.kr ?? undefined}
          onSuccess={() => void afterKRChange()}
          onDelete={() => void afterKRChange()}
          onCancel={() => setKrFormOpen(null)}
        />
      ) : null}

      {participantsOpen && objective ? (
        <ParticipantsForm
          objectiveId={id}
          members={members}
          ownerId={typeof objective.owner === 'string' ? (objective.owner as string) : ''}
          initialIds={parseParticipantIdsLoose(objective.participant_ids)}
          onSuccess={() => {
            setParticipantsOpen(false)
            void loadDetail({ silent: true })
          }}
          onCancel={() => setParticipantsOpen(false)}
        />
      ) : null}
    </div>
  )
}

function parseParticipantIdsLoose(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string' && Boolean(v))
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return []
    try {
      const j = JSON.parse(t)
      if (Array.isArray(j)) return j.filter((v): v is string => typeof v === 'string' && Boolean(v))
    } catch {
      return t.split(/[\s,]+/).filter(Boolean)
    }
  }
  return []
}
