import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { RecordModel } from 'pocketbase'
import { ObjectiveDetailView } from '@/features/objectives'
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
  const [deliverables, setDeliverables] = useState<RecordModel[]>([])
  const [blockers, setBlockers] = useState<RecordModel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const [obj, taskList, delList, blkList] = await Promise.all([
          pb.collection('objectives').getOne(id, { expand: 'owner' }),
          pb.collection('tasks').getFullList({
            filter: `objective="${id}"`,
            expand: 'assignee',
            sort: 'due_date',
          }),
          pb.collection('deliverables').getFullList({
            filter: `objective="${id}"`,
            sort: 'planned_completion_date',
          }),
          pb.collection('blockers').getFullList({
            filter: `objective="${id}"`,
            expand: 'owner',
          }),
        ])

        const severityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }
        blkList.sort(
          (a, b) =>
            (severityRank[String(a.severity ?? '')] ?? 99) - (severityRank[String(b.severity ?? '')] ?? 99),
        )

        if (!cancelled) {
          setObjective(obj)
          setTasks(taskList)
          setDeliverables(delList)
          setBlockers(blkList)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setObjective(null)
          setTasks([])
          setDeliverables([])
          setBlockers([])
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    const st = location.state as DetailLocationState | undefined
    if (st?.objectiveUpdated) {
      setUpdateBanner(true)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])

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
          deliverables={deliverables}
          blockers={blockers}
        />
      ) : null}
    </div>
  )
}
