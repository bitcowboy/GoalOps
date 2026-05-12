import type { RecordModel } from 'pocketbase'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, CheckCircle2, Clock, Pencil, Target, Trash2, User } from 'lucide-react'
import { MetricCard, SectionCard, StatusPill } from '@/components'
import {
  formatDateTime,
  formatDotDate,
  initialsFromName,
  priorityPillTone,
  taskStatusLabel,
} from '@/features/objectives/objectiveDetailUtils'
import { predecessorIds } from '@/features/tasks'
import { pb } from '@/services/pocketbase'

type TaskExpand = {
  objective?: RecordModel
  key_result?: RecordModel
  assignee?: RecordModel
}

type TaskWithExpand = RecordModel & { expand?: TaskExpand }

const STATUS_PIPELINE: { value: string; label: string; tone: 'neutral' | 'success' | 'warning' }[] = [
  { value: 'pending', label: '未开始', tone: 'neutral' },
  { value: 'in_progress', label: '进行中', tone: 'success' },
  { value: 'deliver', label: '交付', tone: 'warning' },
  { value: 'review', label: '验收', tone: 'warning' },
  { value: 'done', label: '完结', tone: 'success' },
]

function statusToneFor(status: string): 'neutral' | 'success' | 'warning' {
  return STATUS_PIPELINE.find((s) => s.value === status)?.tone ?? 'neutral'
}

function statusIndex(status: string): number {
  const idx = STATUS_PIPELINE.findIndex((s) => s.value === status)
  return idx < 0 ? 0 : idx
}

/** 任务详情 — 路由 `/tasks/:id`。点击列表中的任务进入；可编辑、快速更新进度。 */
export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [task, setTask] = useState<TaskWithExpand | null>(null)
  const [predecessors, setPredecessors] = useState<RecordModel[]>([])
  const [successors, setSuccessors] = useState<RecordModel[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return
      if (!opts?.silent) setLoading(true)
      try {
        const record = (await pb.collection('tasks').getOne(id, {
          expand: 'objective,key_result,assignee',
        })) as TaskWithExpand
        setTask(record)

        const predIds = predecessorIds(record.predecessor_ids)
        const [predRecords, succRecords] = await Promise.all([
          predIds.length
            ? pb.collection('tasks').getFullList({
                filter: predIds.map((pid) => `id="${pid}"`).join('||'),
                expand: 'assignee',
              })
            : Promise.resolve<RecordModel[]>([]),
          pb.collection('tasks').getFullList({
            // PocketBase JSON column: substring match on raw text is the practical workaround
            // for "predecessor_ids contains this id".
            filter: `predecessor_ids ~ "${id}" && id != "${id}"`,
            expand: 'assignee',
          }),
        ])
        setPredecessors(predRecords)
        setSuccessors(succRecords)
        setError(null)
      } catch (e) {
        setTask(null)
        setPredecessors([])
        setSuccessors([])
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const refresh = () => {
      if (!cancelled) void load({ silent: true })
    }
    const subPromise = pb.collection('tasks').subscribe('*', refresh)
    return () => {
      cancelled = true
      void subPromise.then((u) => u?.()).catch(() => {})
      void pb.collection('tasks').unsubscribe('*')
    }
  }, [id, load])

  const setStatus = useCallback(
    async (next: string) => {
      if (!id || !task || next === task.status) return
      setUpdatingStatus(next)
      try {
        await pb.collection('tasks').update(id, { status: next })
        await load({ silent: true })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setUpdatingStatus(null)
      }
    },
    [id, task, load],
  )

  const onDelete = useCallback(async () => {
    if (!id || !task) return
    const ok = window.confirm(
      `确定删除任务「${String(task.title ?? '')}」吗？\n\n此操作不可恢复，相关前置依赖也会同时失效。`,
    )
    if (!ok) return
    setDeleting(true)
    try {
      await pb.collection('tasks').delete(id)
      navigate('/tasks', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setDeleting(false)
    }
  }, [id, task, navigate])

  const currentStatus = String(task?.status ?? 'pending')
  const currentIdx = statusIndex(currentStatus)
  const objective = task?.expand?.objective
  const keyResult = task?.expand?.key_result
  const assignee = task?.expand?.assignee
  const priority = String(task?.priority ?? 'P3')
  const dueIso = String(task?.due_date ?? '').slice(0, 10)
  const estHours = useMemo(() => {
    const raw = task?.estimate_hours
    if (raw == null || raw === '') return null
    const n = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(n) ? n : null
  }, [task?.estimate_hours])

  if (!id) {
    return (
      <p className="text-sm text-[var(--goalops-warning)]" role="alert">
        路由缺少任务 ID。
      </p>
    )
  }

  if (loading) {
    return <p className="text-sm text-[var(--goalops-text-muted)]">加载中…</p>
  }

  if (error || !task) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--goalops-danger)]" role="alert">
          {error ?? '任务不存在或已被删除'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/tasks')}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-4 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          返回任务列表
        </button>
      </div>
    )
  }

  const assigneeName = assignee ? String(assignee.name ?? '—') : '—'
  const assigneeTeam = assignee ? String(assignee.team ?? '') : ''
  const assigneeInitials = initialsFromName(assigneeName)

  return (
    <div className="space-y-6">
      <header className="rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-6 shadow-[var(--goalops-shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[var(--goalops-primary)] ring-1 ring-blue-200/80">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-[var(--goalops-text)] md:text-2xl">
                  {String(task.title ?? '')}
                </h1>
                <StatusPill tone={priorityPillTone(priority)}>{priority}</StatusPill>
                <StatusPill tone={statusToneFor(currentStatus)}>{taskStatusLabel(currentStatus)}</StatusPill>
              </div>
              {objective ? (
                <p className="mt-2 text-sm text-[var(--goalops-text-muted)]">
                  所属目标：{' '}
                  <Link
                    to={`/objectives/${objective.id}`}
                    className="font-medium text-[var(--goalops-primary)] hover:underline"
                  >
                    {String(objective.name ?? '—')}
                  </Link>
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--goalops-text-subtle)]">
                <span>
                  任务 ID:{' '}
                  <span className="font-medium text-[var(--goalops-text-muted)]">{task.id}</span>
                </span>
                <span>
                  创建时间:{' '}
                  <span className="font-medium text-[var(--goalops-text-muted)]">{formatDateTime(task.created)}</span>
                </span>
                <span>
                  最后更新:{' '}
                  <span className="font-medium text-[var(--goalops-text-muted)]">{formatDateTime(task.updated)}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/tasks/${task.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
            >
              <Pencil className="size-4 text-[var(--goalops-text-muted)]" aria-hidden />
              编辑任务
            </Link>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--goalops-danger)] shadow-sm hover:bg-[var(--goalops-danger)]/15 disabled:cursor-wait disabled:opacity-60"
            >
              <Trash2 className="size-4" aria-hidden />
              {deleting ? '删除中…' : '删除任务'}
            </button>
            <Link
              to="/tasks"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--goalops-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              <ArrowLeft className="size-4" aria-hidden />
              返回任务列表
            </Link>
          </div>
        </div>
      </header>

      <SectionCard title="进度更新">
        <p className="mb-4 text-sm text-[var(--goalops-text-muted)]">
          点击任意阶段直接更新任务状态，变更会立刻写入 PocketBase。
        </p>
        <ol className="grid gap-2 sm:grid-cols-5">
          {STATUS_PIPELINE.map((step, idx) => {
            const isActive = step.value === currentStatus
            const isPassed = idx < currentIdx
            const isBusy = updatingStatus === step.value
            const baseCls =
              'flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-wait disabled:opacity-60'
            const stateCls = isActive
              ? 'border-[var(--goalops-primary)] bg-[var(--goalops-primary-soft)] text-[var(--goalops-primary)]'
              : isPassed
                ? 'border-[var(--goalops-success)]/40 bg-[var(--goalops-success-soft)] text-[var(--goalops-success)] hover:opacity-95'
                : 'border-[var(--goalops-border)] bg-slate-50/80 text-[var(--goalops-text-muted)] hover:bg-slate-100'
            return (
              <li key={step.value}>
                <button
                  type="button"
                  onClick={() => void setStatus(step.value)}
                  disabled={isBusy || isActive}
                  aria-current={isActive ? 'step' : undefined}
                  className={`${baseCls} ${stateCls}`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                    第 {idx + 1} 阶段
                  </span>
                  <span className="text-base font-semibold">{step.label}</span>
                  {isBusy ? (
                    <span className="text-[11px] opacity-80">更新中…</span>
                  ) : isActive ? (
                    <span className="text-[11px] opacity-80">当前状态</span>
                  ) : isPassed ? (
                    <span className="text-[11px] opacity-80">已完成</span>
                  ) : (
                    <span className="text-[11px] opacity-80">点击切换</span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="负责人">
          <div className="flex items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: '#64748b' }}
              aria-hidden
            >
              {assigneeInitials}
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-[var(--goalops-text)]">{assigneeName}</div>
              <div className="truncate text-sm text-[var(--goalops-text-muted)]">{assigneeTeam || '—'}</div>
            </div>
          </div>
        </MetricCard>
        <MetricCard label="截止日期">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[var(--goalops-text-muted)]">
              <Calendar className="size-5" aria-hidden />
            </span>
            <div>
              <div className="text-lg font-semibold tabular-nums text-[var(--goalops-text)]">
                {formatDotDate(dueIso)}
              </div>
              <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">
                {dueIso ? 'YYYY.MM.DD' : '未设置'}
              </div>
            </div>
          </div>
        </MetricCard>
        <MetricCard label="预计工时">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[var(--goalops-text-muted)]">
              <Clock className="size-5" aria-hidden />
            </span>
            <div>
              <div className="text-lg font-semibold tabular-nums text-[var(--goalops-text)]">
                {estHours != null ? `${estHours} h` : '—'}
              </div>
              <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">
                {estHours != null ? '人日工作量估算' : '未填写'}
              </div>
            </div>
          </div>
        </MetricCard>
        <MetricCard label="关联 KR">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[var(--goalops-text-muted)]">
              <Target className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--goalops-text)]">
                {keyResult ? String(keyResult.name ?? '—') : '未关联 KR'}
              </div>
              <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">
                {keyResult ? (keyResult.is_completed ? '已完成' : '进行中') : '可在编辑页设置'}
              </div>
            </div>
          </div>
        </MetricCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="前置任务">
          {predecessors.length === 0 ? (
            <p className="text-sm text-[var(--goalops-text-muted)]">无前置任务依赖。</p>
          ) : (
            <ul className="space-y-2">
              {predecessors.map((p) => {
                const pst = String(p.status ?? '')
                const ppr = String(p.priority ?? '')
                return (
                  <li key={p.id}>
                    <Link
                      to={`/tasks/${p.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--goalops-border)] bg-slate-50/40 px-3 py-2 hover:bg-slate-50"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-[var(--goalops-text)]">
                        {String(p.title ?? '')}
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusPill tone={priorityPillTone(ppr)}>{ppr}</StatusPill>
                        <StatusPill tone={statusToneFor(pst)}>{taskStatusLabel(pst)}</StatusPill>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="依赖本任务的后置任务">
          {successors.length === 0 ? (
            <p className="text-sm text-[var(--goalops-text-muted)]">暂无任务依赖本任务。</p>
          ) : (
            <ul className="space-y-2">
              {successors.map((s) => {
                const sst = String(s.status ?? '')
                const spr = String(s.priority ?? '')
                const assigneeRec = (s.expand as TaskExpand | undefined)?.assignee
                const an = assigneeRec ? String(assigneeRec.name ?? '') : ''
                return (
                  <li key={s.id}>
                    <Link
                      to={`/tasks/${s.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--goalops-border)] bg-slate-50/40 px-3 py-2 hover:bg-slate-50"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-[var(--goalops-text)]">
                          {String(s.title ?? '')}
                        </span>
                        {an ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--goalops-text-muted)]">
                            <User className="size-3" aria-hidden />
                            {an}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <StatusPill tone={priorityPillTone(spr)}>{spr}</StatusPill>
                        <StatusPill tone={statusToneFor(sst)}>{taskStatusLabel(sst)}</StatusPill>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
