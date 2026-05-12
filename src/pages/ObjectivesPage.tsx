import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Flag, ListChecks, Plus, Target, TrendingUp } from 'lucide-react'
import {
  MetricCard,
  MiniSparkline,
  ProgressBar,
  SectionCard,
  SemiCircleGauge,
  StatusPill,
} from '@/components'
import {
  fetchObjectivesList,
  type ObjectiveListHealth,
  type ObjectiveListRow,
  type ObjectivesListPayload,
} from '@/features/objectives/loadObjectivesList'

function healthDot(health: ObjectiveListHealth) {
  const map = {
    normal: 'bg-[var(--goalops-success)]',
    risk: 'bg-[var(--goalops-warning)]',
    blocked: 'bg-[var(--goalops-danger)]',
  }
  return <span className={`inline-block size-2 rounded-full ${map[health]}`} aria-hidden />
}

function healthLabel(health: ObjectiveListHealth) {
  const labels = { normal: '正常', risk: '风险', blocked: '阻塞' }
  return labels[health]
}

function priorityTone(p: ObjectiveListRow['priority']) {
  if (p === '高') return 'high' as const
  if (p === '中') return 'medium' as const
  return 'low' as const
}

type ObjectivesLocationState = { objectiveCreated?: boolean; objectiveName?: string }

/** 全部目标列表 — PocketBase 数据，版面与目标看板对齐。 */
export function ObjectivesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [createSuccessBanner, setCreateSuccessBanner] = useState<string | null>(null)
  const [data, setData] = useState<ObjectivesListPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await fetchObjectivesList()
      setData(payload)
      setError(null)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void reload())
  }, [reload])

  useEffect(() => {
    queueMicrotask(() => {
      const s = location.state as ObjectivesLocationState | undefined
      if (s?.objectiveCreated) {
        const name =
          typeof s.objectiveName === 'string' && s.objectiveName.trim() ? s.objectiveName.trim() : ''
        setCreateSuccessBanner(name ? `已成功创建目标「${name}」。` : '已成功创建目标。')
        navigate(location.pathname, { replace: true, state: {} })
      }
    })
  }, [location.pathname, location.state, navigate])

  const kpis = data?.kpis
  const rows = data?.rows ?? []
  const sparkPoints = data?.sparkline_points?.length
    ? data.sparkline_points
    : [0.35, 0.42, 0.5, 0.55, 0.62, 0.7, 0.78]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--goalops-text)]">目标列表</h1>
          <p className="mt-1 text-sm text-[var(--goalops-text-muted)]">AI 创新中心 · 全部目标与关键指标</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/objectives/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="size-4" aria-hidden />
            创建目标
          </Link>
          <button
            type="button"
            className="rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={loading}
            onClick={() => void reload()}
          >
            刷新
          </button>
          <Link
            to="/"
            className="rounded-lg border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-2 text-sm font-medium text-[var(--goalops-text)] hover:bg-slate-100"
          >
            返回概览
          </Link>
        </div>
      </header>

      {createSuccessBanner ? (
        <div
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--goalops-success)]/35 bg-[var(--goalops-success-soft)] px-4 py-3 text-sm font-medium text-[var(--goalops-success)]"
          role="status"
        >
          <span>{createSuccessBanner}</span>
          <button
            type="button"
            onClick={() => setCreateSuccessBanner(null)}
            className="shrink-0 text-[var(--goalops-success)] underline decoration-[var(--goalops-success)]/50 underline-offset-2 hover:decoration-current"
          >
            关闭
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger)]/10 px-4 py-3 text-sm text-[var(--goalops-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="当前周期" sub={kpis ? `${kpis.period_range}` : loading ? '加载中…' : '—'}>
          <div className="text-xl font-semibold tabular-nums text-[var(--goalops-text)]">
            {kpis?.period_label ?? (loading ? '…' : '—')}
          </div>
        </MetricCard>
        <MetricCard label="目标总数">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--goalops-primary-soft)] text-[var(--goalops-primary)]">
              <Target className="size-6" aria-hidden />
            </span>
            <span className="text-3xl font-semibold tabular-nums">
              {kpis?.total_goals ?? (loading ? '…' : '0')}
            </span>
          </div>
        </MetricCard>
        <MetricCard label="正常目标" sub={kpis ? `${kpis.normal_goals.pct}%` : undefined}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-success)]">
              {kpis?.normal_goals.count ?? (loading ? '…' : '0')}
            </span>
            {kpis ? <SemiCircleGauge value={kpis.normal_goals.pct} accent="var(--goalops-success)" /> : null}
          </div>
        </MetricCard>
        <MetricCard label="风险目标" sub={kpis ? `${kpis.risk_goals.pct}%` : undefined}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-warning)]">
              {kpis?.risk_goals.count ?? (loading ? '…' : '0')}
            </span>
            {kpis ? <SemiCircleGauge value={kpis.risk_goals.pct} accent="var(--goalops-warning)" /> : null}
          </div>
        </MetricCard>
        <MetricCard label="高优先级任务">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <ListChecks className="size-6" aria-hidden />
              </span>
              <span className="text-3xl font-semibold tabular-nums">
                {kpis?.high_priority_tasks.count ?? (loading ? '…' : '0')}
              </span>
            </div>
            {kpis ? (
              <span className="rounded-md bg-[var(--goalops-success-soft)] px-2 py-1 text-xs font-semibold text-[var(--goalops-success)]">
                {kpis.high_priority_tasks.delta}
              </span>
            ) : null}
          </div>
        </MetricCard>
        <MetricCard label="平均进度 / KR">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-3xl font-semibold tabular-nums">
                {kpis
                  ? kpis.avg_kr_completion_pct != null
                    ? `${kpis.avg_kr_completion_pct}%`
                    : `${kpis.avg_progress_pct}%`
                  : loading
                    ? '…'
                    : '—'}
              </div>
              {kpis ? (
                <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">
                  {kpis.avg_kr_completion_pct != null
                    ? `KR 平均 · 全部 ${kpis.avg_progress_pct}% 展示进度`
                    : '无 KR 数据 · 使用目标进度字段'}
                </div>
              ) : null}
              {kpis ? (
                <div className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--goalops-success)]">
                  <TrendingUp className="size-3.5" aria-hidden />
                  周环比 {kpis.avg_progress_delta}
                </div>
              ) : null}
            </div>
            <MiniSparkline points={sparkPoints} />
          </div>
        </MetricCard>
      </div>

      <SectionCard
        title="全部目标"
        action={
          <span className="text-xs text-[var(--goalops-text-muted)]">
            {loading ? '加载中…' : `${rows.length} 条`}
          </span>
        }
      >
        {loading && !data ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--goalops-text-muted)]">正在加载目标数据…</div>
        ) : !loading && rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--goalops-text-muted)]">暂无目标记录。</div>
        ) : (
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--goalops-border)] bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                  <th className="whitespace-nowrap px-5 py-3">目标</th>
                  <th className="whitespace-nowrap px-5 py-3">定义</th>
                  <th className="whitespace-nowrap px-5 py-3">KR</th>
                  <th className="whitespace-nowrap px-5 py-3">任务</th>
                  <th className="whitespace-nowrap px-5 py-3">进度</th>
                  <th className="whitespace-nowrap px-5 py-3">健康度</th>
                  <th className="whitespace-nowrap px-5 py-3">优先级</th>
                  <th className="whitespace-nowrap px-5 py-3">负责人</th>
                  <th className="whitespace-nowrap px-5 py-3">当前阻塞</th>
                  <th className="whitespace-nowrap px-5 py-3">下一步动作</th>
                  <th className="whitespace-nowrap px-5 py-3">更新</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--goalops-border)]">
                {rows.map((row) => (
                  <tr key={row.id} className="bg-[var(--goalops-surface)] hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <Flag className="size-4" aria-hidden />
                        </span>
                        <Link
                          to={`/objectives/${row.id}`}
                          className="font-medium text-[var(--goalops-primary)] hover:underline"
                        >
                          {row.name}
                        </Link>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-5 py-4 text-[var(--goalops-text-muted)]">
                      <span className="line-clamp-2">{row.definition}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-[var(--goalops-text-muted)]">
                      {row.kr_total === 0 ? (
                        <span className="text-[var(--goalops-warning)]">未定义</span>
                      ) : (
                        <>
                          <span className="font-medium text-[var(--goalops-text)]">
                            {row.kr_completed} / {row.kr_total}
                          </span>
                          {row.kr_percent != null ? (
                            <span className="ml-1 tabular-nums">· {row.kr_percent}%</span>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-[var(--goalops-text-muted)]">
                      {row.task_total === 0 ? (
                        '—'
                      ) : (
                        <>
                          {row.task_completed} / {row.task_total} ·{' '}
                          {Math.round((row.task_completed / row.task_total) * 100)}%
                        </>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="w-[140px] space-y-1">
                        <div className="flex justify-between text-xs text-[var(--goalops-text-muted)]">
                          <span>{row.progress_display_pct}%</span>
                        </div>
                        <ProgressBar value={row.progress_display_pct} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2">
                        {healthDot(row.health)}
                        <span className="text-[var(--goalops-text)]">{healthLabel(row.health)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={priorityTone(row.priority)}>{row.priority}</StatusPill>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: row.owner_color }}
                        >
                          {row.owner_initials}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[var(--goalops-text)]">{row.owner_name}</div>
                          <div className="truncate text-xs text-[var(--goalops-text-muted)]">{row.owner_team}</div>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-5 py-4 text-[var(--goalops-text-muted)]">
                      <span className="line-clamp-2">{row.blockers}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[200px]">
                        <div className="font-medium text-[var(--goalops-text)]">{row.next_action}</div>
                        <div className="mt-0.5 text-xs text-[var(--goalops-text-muted)]">{row.next_action_date}</div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-[var(--goalops-text-muted)]">{row.updated_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
