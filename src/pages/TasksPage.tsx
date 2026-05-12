import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  ListChecks,
  Plus,
  RotateCcw,
  Search as SearchIcon,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import {
  MetricCard,
  SectionCard,
  SemiCircleGauge,
  StatusPill,
} from '@/components'
import type { TasksBoardPayload, TaskRiskLevel } from '@/features/tasks'
import { fetchTasksBoard } from '@/features/tasks'
import { priorityPillTone, taskStatusLabel } from '@/features/objectives/objectiveDetailUtils'
import { pb, getPocketBaseUrl } from '@/services/pocketbase'

const selectCls =
  'min-w-[120px] rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-2 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] focus:bg-[var(--goalops-surface)] focus:ring-2'

const STATUS_FILTER_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'deliver', label: '交付' },
  { value: 'review', label: '验收' },
  { value: 'done', label: '完结' },
] as const

const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: '全部优先级' },
  { value: 'P0', label: 'P0' },
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
  { value: 'P3', label: 'P3' },
] as const

function formatDueMd(iso: string): string {
  if (!iso) return '—'
  const [, m = '', d = ''] = iso.split('-')
  return `${m}-${d}`
}

function TaskStatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-[var(--goalops-text-subtle)]',
    in_progress: 'bg-[var(--goalops-primary)]',
    deliver: 'bg-[var(--goalops-warning)]',
    review: 'bg-[var(--goalops-warning)]',
    done: 'bg-[var(--goalops-success)]',
  }
  const cls = map[status] ?? 'bg-[var(--goalops-text-subtle)]'
  return <span className={`inline-block size-2 rounded-full ${cls}`} aria-hidden />
}

function riskDotClass(r: TaskRiskLevel): string {
  if (r === 'normal') return 'bg-[var(--goalops-success)]'
  if (r === 'risk') return 'bg-[var(--goalops-warning)]'
  return 'bg-[var(--goalops-danger)]'
}

function riskLabel(r: TaskRiskLevel): string {
  if (r === 'normal') return '正常'
  if (r === 'risk') return '风险'
  return '高风险'
}

const DEFAULT_HEALTH_SLICES = {
  normal: { count: 0, label: '正常', pct: 0 },
  risk: { count: 0, label: '风险', pct: 0 },
  blocked: { count: 0, label: '阻塞', pct: 0 },
  not_started: { count: 0, label: '未开始', pct: 0 },
} satisfies TasksBoardPayload['healthSlices']

const EMPTY_ROWS: TasksBoardPayload['rows'] = []

const piePalette = {
  normal: '#22c55e',
  risk: '#f97316',
  blocked: '#ef4444',
  not_started: '#94a3b8',
}

const tasksUiInitial = {
  searchQuery: '',
  objectiveId: '',
  assigneeId: '',
  statusFilter: '',
  priorityFilter: '',
  keyResultFilter: '',
  deadlineUntil: '',
  blockedOnly: false,
  mineOnly: false,
  page: 1,
  pageSize: 10,
} as const

type TasksUiState = {
  searchQuery: string
  objectiveId: string
  assigneeId: string
  statusFilter: string
  priorityFilter: string
  keyResultFilter: string
  deadlineUntil: string
  blockedOnly: boolean
  mineOnly: boolean
  page: number
  pageSize: number
}

export function TasksPage() {
  const [snapshot, setSnapshot] = useState<TasksBoardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ui, setUi] = useState<TasksUiState>({ ...tasksUiInitial })

  const currentMemberId = pb.authStore.record?.id

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setLoading(true)
    try {
      const data = await fetchTasksBoard()
      setSnapshot(data)
      setError(null)
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : String(e))
        setSnapshot(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchSilent = async () => {
      try {
        const data = await fetchTasksBoard()
        if (cancelled) return
        setSnapshot(data)
        setError(null)
      } catch {
        /** keep previous snapshot on background refresh failures */
      }
    }

    queueMicrotask(() => {
      void load(false)
    })

    const subPromise = Promise.all([
      pb.collection('tasks').subscribe('*', () => void fetchSilent()),
      pb.collection('blockers').subscribe('*', () => void fetchSilent()),
      pb.collection('key_results').subscribe('*', () => void fetchSilent()),
    ])

    return () => {
      cancelled = true
      void subPromise.then((uns) => uns.forEach((u) => void u?.())).catch(() => {})
      void pb.collection('tasks').unsubscribe('*')
      void pb.collection('blockers').unsubscribe('*')
      void pb.collection('key_results').unsubscribe('*')
    }
  }, [load])

  function patchFilters(patch: Partial<Omit<TasksUiState, 'page' | 'pageSize'>>) {
    setUi((s) => ({ ...s, ...patch, page: 1 }))
  }

  function goToPage(next: number) {
    setUi((s) => ({ ...s, page: next }))
  }

  function setPageSize(next: number) {
    setUi((s) => ({ ...s, pageSize: next, page: 1 }))
  }

  const {
    searchQuery,
    objectiveId,
    assigneeId,
    statusFilter,
    priorityFilter,
    keyResultFilter,
    deadlineUntil,
    blockedOnly,
    mineOnly,
    page,
    pageSize,
  } = ui

  const rows = useMemo(() => snapshot?.rows ?? EMPTY_ROWS, [snapshot])

  const keyResultPicklist = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of rows) {
      if (t.keyResultId && t.keyResultName) {
        m.set(t.keyResultId, t.keyResultName)
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
  }, [rows])

  const objectiveOptions = useMemo(() => {
    const base = snapshot?.objectives ?? []
    return [{ value: '', label: '全部目标' }, ...base.map((o) => ({ value: o.id, label: String(o.name ?? o.id) }))]
  }, [snapshot?.objectives])

  const assigneeOptions = useMemo(() => {
    const base = snapshot?.members ?? []
    return [
      { value: '', label: '全部负责人' },
      ...base.map((m) => ({ value: m.id, label: String(m.name ?? m.id) })),
    ]
  }, [snapshot?.members])

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return rows.filter((t) => {
      if (blockedOnly && !(t.objectiveHasBlocker && t.pbStatus !== 'done')) return false
      if (mineOnly) {
        if (!currentMemberId) return false
        if (t.assigneeId !== currentMemberId) return false
      }
      if (objectiveId && t.objectiveId !== objectiveId) return false
      if (assigneeId && t.assigneeId !== assigneeId) return false
      if (statusFilter && t.pbStatus !== statusFilter) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (keyResultFilter === '__linked__' && !t.keyResultId) return false
      if (keyResultFilter === '__none__' && t.keyResultId) return false
      if (
        keyResultFilter &&
        keyResultFilter !== '__linked__' &&
        keyResultFilter !== '__none__' &&
        t.keyResultId !== keyResultFilter
      )
        return false
      if (deadlineUntil) {
        if (!t.dueIso || t.dueIso > deadlineUntil) return false
      }
      if (q) {
        const haystack = `${t.title} ${t.objectiveName} ${t.assigneeName} ${t.prerequisiteLabel ?? ''} ${t.keyResultName}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [
    rows,
    searchQuery,
    objectiveId,
    assigneeId,
    statusFilter,
    priorityFilter,
    keyResultFilter,
    deadlineUntil,
    blockedOnly,
    mineOnly,
    currentMemberId,
  ])

  const totalFiltered = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const pageSlice = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const healthSlices = useMemo(() => snapshot?.healthSlices ?? DEFAULT_HEALTH_SLICES, [snapshot])

  const kpis = snapshot?.kpis

  const pieData = useMemo(
    () => [
      { key: 'normal', name: healthSlices.normal.label, value: healthSlices.normal.count, fill: piePalette.normal },
      { key: 'risk', name: healthSlices.risk.label, value: healthSlices.risk.count, fill: piePalette.risk },
      {
        key: 'blocked',
        name: healthSlices.blocked.label,
        value: healthSlices.blocked.count,
        fill: piePalette.blocked,
      },
      {
        key: 'not_started',
        name: healthSlices.not_started.label,
        value: healthSlices.not_started.count,
        fill: piePalette.not_started,
      },
    ],
    [healthSlices],
  )

  const dependencyAlerts = snapshot?.dependencyAlerts ?? []

  const currentMemberName =
    snapshot?.members.find((m) => m.id === currentMemberId)?.name ??
    pb.authStore.record?.name ??
    null

  function resetFilters() {
    setUi({ ...tasksUiInitial })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--goalops-text)]">任务</h1>
          <p className="mt-1 text-sm text-[var(--goalops-text-muted)]">
            数据源：PocketBase（{getPocketBaseUrl()}），订阅{' '}
            <code className="text-xs">tasks</code> /{' '}
            <code className="text-xs">blockers</code> /{' '}
            <code className="text-xs">key_results</code>
            {' '}自动刷新列表
          </p>
          {loading && <p className="mt-1 text-xs text-[var(--goalops-text-subtle)]">加载中…</p>}
          {error && (
            <p className="mt-1 text-sm font-medium text-[var(--goalops-danger)]" role="alert">
              {error}
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="总任务数" sub="实时汇总">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <ListChecks className="size-6" aria-hidden />
                  </span>
                  <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-text)]">
                    {kpis?.total ?? 0}
                  </span>
                </div>
              </div>
            </MetricCard>
            <MetricCard label="进行中" sub={kpis ? `${kpis.in_progress.pct}%` : '—'}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-primary)]">
                  {kpis?.in_progress.count ?? 0}
                </span>
                <SemiCircleGauge value={kpis?.in_progress.pct ?? 0} accent="var(--goalops-primary)" />
              </div>
            </MetricCard>
            <MetricCard label="待验收" sub={kpis ? `${kpis.pending_review.pct}%` : '—'}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-warning)]">
                  {kpis?.pending_review.count ?? 0}
                </span>
                <SemiCircleGauge value={kpis?.pending_review.pct ?? 0} accent="var(--goalops-warning)" />
              </div>
            </MetricCard>
            <MetricCard label="已阻塞" sub={kpis ? `${kpis.blocked.pct}%` : '—'}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-danger)]">
                  {kpis?.blocked.count ?? 0}
                </span>
                <SemiCircleGauge value={kpis?.blocked.pct ?? 0} accent="var(--goalops-danger)" />
              </div>
            </MetricCard>
            <MetricCard label="本周到期" sub="未完结且在本周区间内">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--goalops-primary-soft)] text-[var(--goalops-primary)]">
                    <Calendar className="size-6" aria-hidden />
                  </span>
                  <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-text)]">
                    {kpis?.due_this_week.count ?? 0}
                  </span>
                </div>
              </div>
            </MetricCard>
          </div>

          <div className="rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-4 shadow-[var(--goalops-shadow-card)]">
            <div className="flex flex-col gap-4">
              <div className="relative min-w-0">
                <SearchIcon
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--goalops-text-subtle)]"
                  aria-hidden
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => patchFilters({ searchQuery: e.target.value })}
                  placeholder="在列表中搜索任务名称、目标或前置说明"
                  className="w-full rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] placeholder:text-[var(--goalops-text-subtle)] focus:bg-[var(--goalops-surface)] focus:ring-2"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={selectCls}
                  value={objectiveId}
                  onChange={(e) => patchFilters({ objectiveId: e.target.value })}
                  aria-label="所属目标"
                >
                  {objectiveOptions.map((o) => (
                    <option key={o.value || 'all-o'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className={selectCls}
                  value={assigneeId}
                  onChange={(e) => patchFilters({ assigneeId: e.target.value })}
                  aria-label="负责人"
                >
                  {assigneeOptions.map((o) => (
                    <option key={o.value || 'all-a'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className={selectCls}
                  value={statusFilter}
                  onChange={(e) => patchFilters({ statusFilter: e.target.value })}
                  aria-label="状态"
                >
                  {STATUS_FILTER_OPTIONS.map((o) => (
                    <option key={o.value || 'all-s'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className={selectCls}
                  value={priorityFilter}
                  onChange={(e) => patchFilters({ priorityFilter: e.target.value })}
                  aria-label="优先级"
                >
                  {PRIORITY_FILTER_OPTIONS.map((o) => (
                    <option key={o.value || 'all-p'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <select
                  className={selectCls}
                  value={keyResultFilter}
                  onChange={(e) => patchFilters({ keyResultFilter: e.target.value })}
                  aria-label="关键结果 KR"
                >
                  <option value="">全部 KR</option>
                  <option value="__linked__">仅已关联 KR</option>
                  <option value="__none__">未关联 KR</option>
                  {keyResultPicklist.map(([kid, label]) => (
                    <option key={kid} value={kid}>
                      {label}
                    </option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--goalops-text-muted)]">
                  <Calendar className="size-4 text-[var(--goalops-text-subtle)]" aria-hidden />
                  <span className="whitespace-nowrap">截止日期</span>
                  <input
                    type="date"
                    value={deadlineUntil}
                    onChange={(e) => patchFilters({ deadlineUntil: e.target.value })}
                    className="rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 px-2 py-2 text-sm text-[var(--goalops-text)] outline-none focus:ring-2 focus:ring-[var(--goalops-primary)]"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--goalops-text-muted)]">
                    <input
                      type="checkbox"
                      checked={blockedOnly}
                      onChange={(e) => patchFilters({ blockedOnly: e.target.checked })}
                      className="size-4 rounded border-[var(--goalops-border)] text-[var(--goalops-primary)] focus:ring-[var(--goalops-primary)]"
                    />
                    只看阻塞任务（目标存在卡点）
                  </label>
                  <label
                    className={`flex items-center gap-2 text-sm ${
                      currentMemberId
                        ? 'cursor-pointer text-[var(--goalops-text-muted)]'
                        : 'cursor-not-allowed text-[var(--goalops-text-subtle)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={mineOnly && !!currentMemberId}
                      disabled={!currentMemberId}
                      onChange={(e) =>
                        patchFilters({ mineOnly: currentMemberId ? e.target.checked : false })
                      }
                      className="size-4 rounded border-[var(--goalops-border)] text-[var(--goalops-primary)] focus:ring-[var(--goalops-primary)] disabled:opacity-40"
                    />
                    只看我的任务
                    {currentMemberId && currentMemberName ? `（${currentMemberName}）` : '（请先登录成员账号）'}
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void load(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    刷新
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-[var(--goalops-text-muted)] hover:bg-slate-100 hover:text-[var(--goalops-text)]"
                  >
                    重置
                  </button>
                  <Link
                    to="/tasks/new"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  >
                    <Plus className="size-4" aria-hidden />
                    新建任务
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <SectionCard title="任务列表">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-[var(--goalops-border)] bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                    <th className="whitespace-nowrap px-5 py-3">所属目标</th>
                    <th className="whitespace-nowrap px-5 py-3">关键结果 KR</th>
                    <th className="whitespace-nowrap px-5 py-3">任务名称</th>
                    <th className="whitespace-nowrap px-5 py-3">状态</th>
                    <th className="whitespace-nowrap px-5 py-3">负责人</th>
                    <th className="whitespace-nowrap px-5 py-3">前置任务</th>
                    <th className="whitespace-nowrap px-5 py-3">优先级</th>
                    <th className="whitespace-nowrap px-5 py-3">截止日期</th>
                    <th className="whitespace-nowrap px-5 py-3">预计工时</th>
                    <th className="whitespace-nowrap px-5 py-3">风险</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--goalops-border)]">
                  {pageSlice.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-10 text-center text-[var(--goalops-text-muted)]">
                        {snapshot && !error ? '没有匹配的任务，尝试调整筛选条件' : '暂无任务数据'}
                      </td>
                    </tr>
                  ) : (
                    pageSlice.map((t) => {
                      const pillTone = priorityPillTone(t.priority)
                      return (
                        <tr key={t.id} className="bg-[var(--goalops-surface)] hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-5 py-3">
                            <div className="flex max-w-[220px] items-center gap-2">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: t.objectiveDotColor }}
                                aria-hidden
                              />
                              <span className="truncate text-[var(--goalops-text)]">{t.objectiveName}</span>
                            </div>
                          </td>
                          <td className="max-w-[200px] px-5 py-3 text-sm">
                            {t.keyResultName ? (
                              <span className="line-clamp-2 font-medium text-[var(--goalops-text)]">{t.keyResultName}</span>
                            ) : (
                              <span className="text-[var(--goalops-text-subtle)]">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3 font-medium text-[var(--goalops-text)]">
                            <Link to={`/tasks/${t.id}/edit`} className="hover:text-[var(--goalops-primary)] hover:underline">
                              {t.title}
                            </Link>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <div className="flex items-center gap-2">
                              <TaskStatusDot status={t.pbStatus} />
                              <span className="text-[var(--goalops-text-muted)]">
                                {taskStatusLabel(t.pbStatus)}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                style={{ backgroundColor: t.assigneeAvatarColor }}
                              >
                                <span className="max-w-[28px] truncate">{t.assigneeInitials}</span>
                              </span>
                              <span className="truncate text-[var(--goalops-text)]">{t.assigneeName}</span>
                            </div>
                          </td>
                          <td className="max-w-[160px] px-5 py-3 text-[var(--goalops-text-muted)]">
                            <span className="line-clamp-2">{t.prerequisiteLabel ?? '—'}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <StatusPill
                              tone={pillTone}
                              className={
                                pillTone === 'low'
                                  ? '!bg-[var(--goalops-primary-soft)] !font-semibold !text-[var(--goalops-primary)]'
                                  : '!font-semibold'
                              }
                            >
                              {t.priority}
                            </StatusPill>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[var(--goalops-text-muted)]">
                            {formatDueMd(t.dueIso)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[var(--goalops-text-muted)]">
                            {t.estimatedHours ? `${t.estimatedHours}h` : '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block size-2 rounded-full ${riskDotClass(t.risk)}`} aria-hidden />
                              <span className="text-[var(--goalops-text-muted)]">{riskLabel(t.risk)}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--goalops-border)] pt-4">
              <p className="text-sm text-[var(--goalops-text-muted)]">
                共{' '}
                <span className="font-semibold tabular-nums text-[var(--goalops-text)]">{totalFiltered}</span> 条
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <nav className="flex flex-wrap items-center gap-1" aria-label="分页">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
                    const active = n === safePage
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => goToPage(n)}
                        className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-slate-900 text-white'
                            : 'border border-transparent text-[var(--goalops-text-muted)] hover:bg-slate-100 hover:text-[var(--goalops-text)]'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  })}
                </nav>
                <label className="flex items-center gap-2 text-sm text-[var(--goalops-text-muted)]">
                  <select
                    value={pageSize}
                    className={`${selectCls} min-w-[100px]`}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    aria-label="每页条数"
                  >
                    <option value={10}>10 条/页</option>
                    <option value={20}>20 条/页</option>
                    <option value={50}>50 条/页</option>
                  </select>
                </label>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="依赖风险提醒"
            action={
              <button type="button" className="text-sm font-medium text-[var(--goalops-primary)] hover:underline">
                查看全部
              </button>
            }
          >
            <ul className="space-y-4">
              {dependencyAlerts.length === 0 ? (
                <li className="py-4 text-center text-sm text-[var(--goalops-text-muted)]">暂无未满足前置依赖的任务</li>
              ) : (
                dependencyAlerts.map((a) => (
                  <li key={a.id} className="border-b border-[var(--goalops-border)] pb-4 last:border-0 last:pb-0">
                    <div className="flex gap-2">
                      <span
                        className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${a.level === 'critical' ? 'bg-[var(--goalops-danger)]' : 'bg-[var(--goalops-warning)]'}`}
                        aria-hidden
                      />
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-[var(--goalops-text)]">{a.taskTitle}</p>
                        <p className="text-xs leading-relaxed text-[var(--goalops-text-muted)]">{a.dependencyNote}</p>
                        <p className="text-xs font-medium text-[var(--goalops-danger)]">{a.blockedForLabel}</p>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </SectionCard>

          <SectionCard
            title="孤儿任务提醒"
            action={
              <button type="button" className="text-sm font-medium text-[var(--goalops-primary)] hover:underline">
                查看全部
              </button>
            }
          >
            <p className="py-6 text-center text-sm text-[var(--goalops-text-muted)]">
              PocketBase 模型要求任务绑定目标；当前暂无孤儿任务
            </p>
          </SectionCard>

          <SectionCard title="任务健康度">
            <div className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--goalops-text-muted)]">
                    <span className="size-2 rounded-full" style={{ backgroundColor: piePalette.normal }} aria-hidden />
                    {healthSlices.normal.label}
                  </span>
                  <span className="tabular-nums text-[var(--goalops-text)]">
                    {healthSlices.normal.count}{' '}
                    <span className="text-xs text-[var(--goalops-text-subtle)]">({healthSlices.normal.pct}%)</span>
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--goalops-text-muted)]">
                    <span className="size-2 rounded-full" style={{ backgroundColor: piePalette.risk }} aria-hidden />
                    {healthSlices.risk.label}
                  </span>
                  <span className="tabular-nums text-[var(--goalops-text)]">
                    {healthSlices.risk.count}{' '}
                    <span className="text-xs text-[var(--goalops-text-subtle)]">({healthSlices.risk.pct}%)</span>
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--goalops-text-muted)]">
                    <span className="size-2 rounded-full" style={{ backgroundColor: piePalette.blocked }} aria-hidden />
                    {healthSlices.blocked.label}
                  </span>
                  <span className="tabular-nums text-[var(--goalops-text)]">
                    {healthSlices.blocked.count}{' '}
                    <span className="text-xs text-[var(--goalops-text-subtle)]">({healthSlices.blocked.pct}%)</span>
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[var(--goalops-text-muted)]">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: piePalette.not_started }}
                      aria-hidden
                    />
                    {healthSlices.not_started.label}
                  </span>
                  <span className="tabular-nums text-[var(--goalops-text)]">
                    {healthSlices.not_started.count}{' '}
                    <span className="text-xs text-[var(--goalops-text-subtle)]">
                      ({healthSlices.not_started.pct}%)
                    </span>
                  </span>
                </li>
              </ul>
              <div className="relative mx-auto h-[200px] w-full max-w-[220px]">
                {kpis?.total === 0 ? (
                  <p className="flex h-full items-center justify-center text-center text-xs text-[var(--goalops-text-muted)]">
                    无任务时可先迁移或新增数据
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={72}
                        strokeWidth={0}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <p className="text-center text-xs font-medium text-[var(--goalops-success)]">
                {kpis?.total === 0 ? '—' : '依当前快照自动分类'}
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
