import { Link } from 'react-router-dom'
import {
  Flag,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  MetricCard,
  MiniSparkline,
  ProgressBar,
  SectionCard,
  SemiCircleGauge,
  StatusPill,
} from '@/components'
import {
  dashboardGoals,
  dashboardKpi,
  dashboardMeetings,
  dashboardRisks,
  dashboardSuggestions,
  type DashboardGoalRow,
  type GoalHealth,
} from '@/data/dashboardMock'

function healthDot(health: GoalHealth) {
  const map = {
    normal: 'bg-[var(--goalops-success)]',
    risk: 'bg-[var(--goalops-warning)]',
    blocked: 'bg-[var(--goalops-danger)]',
  }
  return <span className={`inline-block size-2 rounded-full ${map[health]}`} aria-hidden />
}

function healthLabel(health: GoalHealth) {
  const labels = { normal: '正常', risk: '风险', blocked: '阻塞' }
  return labels[health]
}

function priorityTone(p: DashboardGoalRow['priority']) {
  if (p === '高') return 'high' as const
  if (p === '中') return 'medium' as const
  return 'low' as const
}

/** 部门整体看板 — 高保真 Dashboard（mock 数据见 `dashboardMock.ts`，后续可接 PocketBase）。 */
export function DashboardPage() {
  const occupancySpark = [0.35, 0.42, 0.5, 0.55, 0.62, 0.7, 0.78]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--goalops-text)]">
            部门整体看板
          </h1>
          <p className="mt-1 text-sm text-[var(--goalops-text-muted)]">
            AI 创新中心 · 关键指标与目标进展一览
          </p>
        </div>
      </header>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="当前周期" sub={`${dashboardKpi.period_range}`}>
          <div className="text-xl font-semibold tabular-nums text-[var(--goalops-text)]">
            {dashboardKpi.period_label}
          </div>
        </MetricCard>
        <MetricCard label="目标总数">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--goalops-primary-soft)] text-[var(--goalops-primary)]">
              <Target className="size-6" aria-hidden />
            </span>
            <span className="text-3xl font-semibold tabular-nums">{dashboardKpi.total_goals}</span>
          </div>
        </MetricCard>
        <MetricCard label="正常目标" sub={`${dashboardKpi.normal_goals.pct}%`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-success)]">
              {dashboardKpi.normal_goals.count}
            </span>
            <SemiCircleGauge value={dashboardKpi.normal_goals.pct} accent="var(--goalops-success)" />
          </div>
        </MetricCard>
        <MetricCard label="风险目标" sub={`${dashboardKpi.risk_goals.pct}%`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-warning)]">
              {dashboardKpi.risk_goals.count}
            </span>
            <SemiCircleGauge value={dashboardKpi.risk_goals.pct} accent="var(--goalops-warning)" />
          </div>
        </MetricCard>
        <MetricCard label="高优先级任务">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <ListChecks className="size-6" aria-hidden />
              </span>
              <span className="text-3xl font-semibold tabular-nums">{dashboardKpi.high_priority_tasks.count}</span>
            </div>
            <span className="rounded-md bg-[var(--goalops-success-soft)] px-2 py-1 text-xs font-semibold text-[var(--goalops-success)]">
              {dashboardKpi.high_priority_tasks.delta}
            </span>
          </div>
        </MetricCard>
        <MetricCard label="团队占用率">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-3xl font-semibold tabular-nums">{dashboardKpi.team_occupancy_pct}%</div>
              <div className="mt-1 flex items-center gap-1 text-xs font-medium text-[var(--goalops-success)]">
                <TrendingUp className="size-3.5" aria-hidden />
                {dashboardKpi.team_occupancy_delta}
              </div>
            </div>
            <MiniSparkline points={occupancySpark} />
          </div>
        </MetricCard>
      </div>

      {/* Goal board */}
      <SectionCard
        title="目标看板"
        action={
          <Link to="/objectives" className="text-sm font-medium text-[var(--goalops-primary)] hover:underline">
            查看全部
          </Link>
        }
      >
        <div className="-mx-5 -mb-5 overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--goalops-border)] bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                <th className="whitespace-nowrap px-5 py-3">目标</th>
                <th className="whitespace-nowrap px-5 py-3">定义</th>
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
              {dashboardGoals.map((row) => (
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
                  <td className="px-5 py-4">
                    <div className="w-[140px] space-y-1">
                      <div className="flex justify-between text-xs text-[var(--goalops-text-muted)]">
                        <span>{row.progress_percent}%</span>
                      </div>
                      <ProgressBar value={row.progress_percent} />
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
                  <td className="whitespace-nowrap px-5 py-4 text-[var(--goalops-text-muted)]">
                    {row.updated_at}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Bottom widgets */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="风险与异常"
          action={
            <button type="button" className="text-sm font-medium text-[var(--goalops-primary)] hover:underline">
              查看全部
            </button>
          }
        >
          <ul className="space-y-4">
            {dashboardRisks.map((r) => (
              <li key={r.id} className="flex gap-3 border-b border-[var(--goalops-border)] pb-4 last:border-0 last:pb-0">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${r.level === 'critical' ? 'bg-[var(--goalops-danger)]' : 'bg-[var(--goalops-warning)]'}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--goalops-text)]">{r.title}</div>
                  <p className="mt-1 text-sm text-[var(--goalops-text-muted)]">{r.impact}</p>
                  <div className="mt-2 text-xs text-[var(--goalops-text-subtle)]">{r.time}</div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="日程"
          action={
            <button type="button" className="text-sm font-medium text-[var(--goalops-primary)] hover:underline">
              查看全部
            </button>
          }
        >
          <ul className="space-y-4">
            {dashboardMeetings.map((m) => (
              <li
                key={m.id}
                className="flex gap-3 rounded-xl border border-[var(--goalops-border)] bg-slate-50/50 p-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--goalops-surface)] text-[var(--goalops-primary)] shadow-sm">
                  <Sparkles className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--goalops-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--goalops-primary)]">
                      {m.kind}
                    </span>
                    <span className="font-medium text-[var(--goalops-text)]">{m.title}</span>
                  </div>
                  <div className="mt-2 text-sm text-[var(--goalops-text-muted)]">
                    {m.date} · {m.range}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="本周行动建议"
          action={
            <Link to="/tasks" className="text-sm font-medium text-[var(--goalops-primary)] hover:underline">
              去任务
            </Link>
          }
        >
          <ul className="space-y-3">
            {dashboardSuggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-3 shadow-sm"
              >
                <input
                  type="checkbox"
                  defaultChecked={s.done}
                  className="mt-1 size-4 rounded border-[var(--goalops-border)] text-[var(--goalops-primary)]"
                  aria-label={s.title}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--goalops-text)]">{s.title}</div>
                  <div className="mt-2">
                    <StatusPill tone={s.priority === '高' ? 'high' : 'medium'}>
                      {s.priority === '高' ? '高优先级' : '中优先级'}
                    </StatusPill>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}
