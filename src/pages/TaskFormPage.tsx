import type { FormEvent } from 'react'
import type { RecordModel } from 'pocketbase'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SectionCard } from '@/components'
import { pb } from '@/services/pocketbase'
import { predecessorIds } from '@/features/tasks/loadTasksBoard'

const inputCls =
  'w-full rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-2.5 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] placeholder:text-[var(--goalops-text-subtle)] focus:bg-[var(--goalops-surface)] focus:ring-2 disabled:opacity-60'

const selectCls =
  'w-full rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-2.5 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] focus:bg-[var(--goalops-surface)] focus:ring-2 disabled:opacity-60'

const TASK_STATUSES = [
  ['pending', '未开始'],
  ['in_progress', '进行中'],
  ['deliver', '交付'],
  ['review', '验收'],
  ['done', '完结'],
] as const

const PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const

type TaskDraft = {
  title: string
  objective: string
  key_result: string
  assignee: string
  status: string
  priority: string
  predecessor_ids: string[]
  estimate_hours: string
  due_date: string
}

const emptyTaskDraft: TaskDraft = {
  title: '',
  objective: '',
  key_result: '',
  assignee: '',
  status: 'pending',
  priority: 'P2',
  predecessor_ids: [],
  estimate_hours: '',
  due_date: '',
}

function dateInput(raw: unknown): string {
  if (!raw) return ''
  const s = String(raw)
  return s.length >= 10 ? s.slice(0, 10) : ''
}

export function TaskFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedObjectiveId = isEdit ? '' : (searchParams.get('objective') ?? '')

  const [draft, setDraft] = useState<TaskDraft>(emptyTaskDraft)
  const [objectives, setObjectives] = useState<RecordModel[]>([])
  const [members, setMembers] = useState<RecordModel[]>([])
  const [tasks, setTasks] = useState<RecordModel[]>([])
  const [keyResults, setKeyResults] = useState<RecordModel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [objectiveRows, memberRows, taskRows] = await Promise.all([
        pb.collection('objectives').getFullList({ sort: 'name', batch: 500 }),
        pb.collection('members').getFullList({ sort: 'name', batch: 500 }),
        pb.collection('tasks').getFullList({ sort: 'title', batch: 500 }),
      ])

      let nextDraft = { ...emptyTaskDraft }
      if (id) {
        const record = await pb.collection('tasks').getOne(id)
        nextDraft = {
          title: String(record.title ?? ''),
          objective: typeof record.objective === 'string' ? record.objective : '',
          key_result: typeof record.key_result === 'string' ? record.key_result : '',
          assignee: typeof record.assignee === 'string' ? record.assignee : '',
          status: String(record.status ?? 'pending'),
          priority: String(record.priority ?? 'P2'),
          predecessor_ids: predecessorIds(record.predecessor_ids),
          estimate_hours: record.estimate_hours == null ? '' : String(record.estimate_hours),
          due_date: dateInput(record.due_date),
        }
      } else if (preselectedObjectiveId && objectiveRows.some((o) => o.id === preselectedObjectiveId)) {
        nextDraft.objective = preselectedObjectiveId
      }

      setObjectives(objectiveRows)
      setMembers(memberRows)
      setTasks(taskRows.filter((t) => t.id !== id))
      setDraft(nextDraft)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [id, preselectedObjectiveId])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  useEffect(() => {
    let cancelled = false
    async function loadKeyResults() {
      if (!draft.objective) {
        setKeyResults([])
        return
      }
      const rows = await pb.collection('key_results').getFullList({
        filter: `objective="${draft.objective}"`,
        sort: 'sort_order,name',
        batch: 300,
      })
      if (!cancelled) setKeyResults(rows)
    }
    void loadKeyResults().catch(() => {
      if (!cancelled) setKeyResults([])
    })
    return () => {
      cancelled = true
    }
  }, [draft.objective])

  const validPredecessors = useMemo(() => tasks.filter((t) => t.id !== id), [tasks, id])

  function patch<K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!draft.title.trim()) {
      setError('请填写任务名称')
      return
    }
    if (!draft.objective) {
      setError('请选择所属目标')
      return
    }
    if (!draft.assignee) {
      setError('请选择负责人')
      return
    }

    const hours = draft.estimate_hours.trim() ? Number(draft.estimate_hours) : null
    if (hours !== null && (Number.isNaN(hours) || hours < 0)) {
      setError('预计工时必须是非负数字')
      return
    }

    const payload: Record<string, unknown> = {
      title: draft.title.trim(),
      objective: draft.objective,
      key_result: draft.key_result || null,
      assignee: draft.assignee,
      status: draft.status,
      priority: draft.priority,
      predecessor_ids: draft.predecessor_ids,
      estimate_hours: hours,
    }
    if (draft.due_date) payload.due_date = draft.due_date

    setSaving(true)
    try {
      if (id) await pb.collection('tasks').update(id, payload)
      else await pb.collection('tasks').create(payload)
      navigate('/tasks')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--goalops-text)]">
            {isEdit ? '编辑任务' : '创建任务'}
          </h1>
          <p className="mt-1 text-sm text-[var(--goalops-text-muted)]">
            任务必须绑定目标，可选关联目标下的 KR，并计入负责人占用。
          </p>
        </div>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-4 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          返回任务列表
        </Link>
      </header>

      {loading ? <p className="text-sm text-[var(--goalops-text-muted)]">正在加载...</p> : null}

      <form onSubmit={onSubmit} className="space-y-6">
        <SectionCard title="任务信息">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">任务名称 *</span>
              <input className={`${inputCls} mt-1.5`} value={draft.title} onChange={(e) => patch('title', e.target.value)} />
            </label>

            <label>
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">所属目标 *</span>
              <select
                className={`${selectCls} mt-1.5`}
                value={draft.objective}
                onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value, key_result: '' }))}
              >
                <option value="">请选择目标</option>
                {objectives.map((o) => (
                  <option key={o.id} value={o.id}>{String(o.name ?? o.id)}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">关联 KR</span>
              <select className={`${selectCls} mt-1.5`} value={draft.key_result} onChange={(e) => patch('key_result', e.target.value)}>
                <option value="">不关联 KR</option>
                {keyResults.map((kr) => (
                  <option key={kr.id} value={kr.id}>{String(kr.name ?? kr.id)}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">负责人 *</span>
              <select className={`${selectCls} mt-1.5`} value={draft.assignee} onChange={(e) => patch('assignee', e.target.value)}>
                <option value="">请选择负责人</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{String(m.name ?? m.id)}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">状态</span>
              <select className={`${selectCls} mt-1.5`} value={draft.status} onChange={(e) => patch('status', e.target.value)}>
                {TASK_STATUSES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">优先级</span>
              <select className={`${selectCls} mt-1.5`} value={draft.priority} onChange={(e) => patch('priority', e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">截止日期</span>
              <input type="date" className={`${inputCls} mt-1.5`} value={draft.due_date} onChange={(e) => patch('due_date', e.target.value)} />
            </label>

            <label>
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">预计工时</span>
              <input type="number" min={0} step={0.5} className={`${inputCls} mt-1.5`} value={draft.estimate_hours} onChange={(e) => patch('estimate_hours', e.target.value)} />
            </label>

            <label className="md:col-span-2">
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">前置任务</span>
              <select
                className={`${selectCls} mt-1.5`}
                value={draft.predecessor_ids[0] ?? ''}
                onChange={(e) => patch('predecessor_ids', e.target.value ? [e.target.value] : [])}
              >
                <option value="">无</option>
                {validPredecessors.map((t) => (
                  <option key={t.id} value={t.id}>{String(t.title ?? t.id)}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-[var(--goalops-text-subtle)]">选择一个前置任务；该前置任务未完成时会在任务页显示依赖风险。</p>
            </label>
          </div>
        </SectionCard>

        {error ? <p className="rounded-xl border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger)]/10 px-4 py-3 text-sm text-[var(--goalops-danger)]">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Link to="/tasks" className="rounded-xl border border-[var(--goalops-border)] px-4 py-2 text-sm font-medium text-[var(--goalops-text)]">取消</Link>
          <button type="submit" disabled={saving || loading} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? '保存中...' : isEdit ? '保存更改' : '创建任务'}
          </button>
        </div>
      </form>
    </div>
  )
}
