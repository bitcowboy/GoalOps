import type { RecordModel } from 'pocketbase'
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

import { ObjectiveDetailView } from '@/features/objectives'
import { clampPercent } from '@/features/objectives/objectiveDetailUtils'
import { recomputeObjectiveProgressFromKeyResults } from '@/features/objectives/createObjective'
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
  const [keyResultBusyId, setKeyResultBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDetail = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return
      const silent = Boolean(opts?.silent)
      if (!silent) setLoading(true)
      try {
        const [obj, taskList, blkList, krList] = await Promise.all([
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
        setError(null)
      } catch (e) {
        setObjective(null)
        setTasks([])
        setBlockers([])
        setKeyResults([])
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
          onToggleKeyResult={onToggleKeyResult}
          keyResultBusyId={keyResultBusyId}
        />
      ) : null}
    </div>
  )
}
