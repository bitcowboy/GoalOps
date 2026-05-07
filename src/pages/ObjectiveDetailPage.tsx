import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { RecordModel } from 'pocketbase'
import { ObjectiveDetailView } from '@/features/objectives'
import { pb } from '@/services/pocketbase'

function sortDocsByUpdatedDesc(docs: RecordModel[]) {
  const ms = (r: RecordModel) => {
    const t = Date.parse(String(r.updated ?? ''))
    return Number.isNaN(t) ? 0 : t
  }
  return [...docs].sort((a, b) => ms(b) - ms(a))
}

/** 目标详情 — 对应 PRD `/objectives/:id` */
export function ObjectiveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [objective, setObjective] = useState<(RecordModel & { expand?: { owner?: RecordModel } }) | null>(null)
  const [tasks, setTasks] = useState<RecordModel[]>([])
  const [deliverables, setDeliverables] = useState<RecordModel[]>([])
  const [documents, setDocuments] = useState<RecordModel[]>([])
  const [blockers, setBlockers] = useState<RecordModel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const [obj, taskList, delList, docList, blkList] = await Promise.all([
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
          pb.collection('core_documents').getFullList({
            filter: `objective="${id}"`,
            expand: 'owner',
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

        const docsSorted = sortDocsByUpdatedDesc(docList)

        if (!cancelled) {
          setObjective(obj)
          setTasks(taskList)
          setDeliverables(delList)
          setDocuments(docsSorted)
          setBlockers(blkList)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setObjective(null)
          setTasks([])
          setDeliverables([])
          setDocuments([])
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

  if (!id) {
    return (
      <p className="text-sm text-[var(--goalops-warning)]" role="alert">
        路由缺少目标 ID。
      </p>
    )
  }

  return (
    <div className="space-y-6">
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
          documents={documents}
          blockers={blockers}
        />
      ) : null}
    </div>
  )
}
