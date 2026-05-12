import { AlarmClock, ClipboardList, Cpu, Layers, Users } from 'lucide-react'
import type { JSX } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import type { ObjectiveListRow, ObjectivesListKpi } from '@/features/objectives/loadObjectivesList'
import {
  blockerSeverityLevel,
  fetchObjectivesList,
  OBJECTIVE_ROUTE,
} from '@/features/objectives/loadObjectivesList'
import { cn } from '@/lib/cn'
import { Badge, ButtonLink, DashboardCard } from '@/ui'

type RiskSeverity = ReturnType<typeof blockerSeverityLevel>

function dashboardPriorityBadgeTone(p: ObjectiveListRow['priority']): 'danger' | 'warn' | 'neutral' {
  if (p === '高') return 'danger'
  if (p === '中') return 'warn'
  return 'neutral'
}

function riskTone(severity: RiskSeverity): string {
  if (severity === 'high') return 'bg-[var(--goalops-danger-soft)] border-[rgba(248,113,113,0.35)]'
  if (severity === 'medium') return 'bg-[var(--goalops-warning-soft)] border-[rgba(245,158,11,0.35)]'
  return 'bg-[var(--goalops-surface-2)] border-[var(--goalops-border)]'
}

function riskLevelLabel(severity: RiskSeverity): string {
  if (severity === 'high') return '高'
  if (severity === 'medium') return '中'
  return '低'
}

function suggestionItems(): Array<{ id: string; title: string; desc: string; link: string }> {
  return [
    {
      id: 's1',
      title: '检查关键结果完成情况',
      desc: '聚焦未完成的 Checkbox KR，拆解为当周可执行任务。',
      link: '/objectives',
    },
    {
      id: 's2',
      title: '更新风险与阻塞',
      desc: '在目标详情记录当前阻塞；将高严重度问题同步给负责人。',
      link: '/objectives',
    },
    {
      id: 's3',
      title: '同步人力与负载',
      desc: '前往人员看板核对本周占用，避免关键路径过载。',
      link: '/people',
    },
  ]
}

function buildDashboardRows(objectives: ObjectiveListRow[]): ObjectiveListRow[] {
  const top = [...objectives]
  top.sort((a, b) => (b.progress_display_pct ?? 0) - (a.progress_display_pct ?? 0))
  return top.slice(0, 6)
}

function buildRiskRows(objectives: ObjectiveListRow[]): Array<{
  id: string
  title: string
  desc: string
  severity: RiskSeverity
}> {
  const rows: Array<{ id: string; title: string; desc: string; severity: RiskSeverity }> = []
  for (const o of objectives) {
    if (o.blockers_count <= 0) continue
    for (const br of o.blocker_items.slice(0, 2)) {
      const severity = blockerSeverityLevel(br.severity)
      const desc = br.description.trim()
      if (!desc) continue
      rows.push({
        id: `${o.id}:${desc.slice(0, 48)}`,
        title: `${o.name} · 阻塞`,
        desc,
        severity,
      })
    }
  }
  rows.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })
  return rows.slice(0, 4)
}

export function DashboardPage(): JSX.Element {
  const [kpis, setKpis] = useState<ObjectivesListKpi | null>(null)
  const [rows, setRows] = useState<ObjectiveListRow[]>([])
  const [riskRows, setRiskRows] = useState<
    Array<{ id: string; title: string; desc: string; severity: RiskSeverity }>
  >([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchObjectivesList()
      setKpis(data.kpis)
      setRows(buildDashboardRows(data.rows))
      setRiskRows(buildRiskRows(data.rows))
    } catch {
      setKpis(null)
      setRows([])
      setRiskRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const dashboardKpis = kpis
    ? [
        {
          key: 'active',
          label: '进行中目标',
          value: kpis.active_objectives_count,
          hint: `${kpis.blocked_objectives_count} 个存在阻塞`,
          icon: ClipboardList,
        },
        {
          key: 'kr',
          label: 'KR 平均完成',
          value: kpis.avg_kr_completion_pct != null ? `${kpis.avg_kr_completion_pct}%` : `${kpis.avg_progress_pct}%`,
          hint:
            kpis.avg_kr_completion_pct != null
              ? `展示进度均值 ${kpis.avg_progress_pct}%`
              : '无 KR · 使用目标进度',
          icon: Cpu,
        },
        {
          key: 'blockers',
          label: '活跃阻塞',
          value: kpis.total_blockers,
          hint: `${kpis.blocked_objectives_count} 个目标受影响`,
          icon: AlarmClock,
        },
        {
          key: 'people',
          label: '团队规模',
          value: `${kpis.team_members_count} 人`,
          hint: '来自成员数据',
          icon: Users,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--goalops-text-muted)]">
            GoalOps / 部门目标运营
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">首页总览</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--goalops-text-muted)]">
            基于关键结果（Checkbox）与任务关联的实时进度；阻塞、任务与人员占用集中呈现，帮助负责人快速决策。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/objectives/new" variant="primary" size="sm">
            新建目标
          </ButtonLink>
          <ButtonLink to="/people" variant="secondary" size="sm">
            查看人员
          </ButtonLink>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <DashboardCard key={i} className="p-4">
                <div className="h-16 animate-pulse rounded-lg bg-[var(--goalops-surface-2)]" />
              </DashboardCard>
            ))
          : dashboardKpis.map((k) => (
              <DashboardCard key={k.key} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--goalops-text-muted)]">
                      {k.label}
                    </div>
                    <div className="mt-2 text-3xl font-semibold tabular-nums">{k.value}</div>
                    <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">{k.hint}</div>
                  </div>
                  <div className="grid size-10 place-items-center rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface-2)] text-[var(--goalops-text-muted)]">
                    <k.icon className="size-5" aria-hidden />
                  </div>
                </div>
              </DashboardCard>
            ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <DashboardCard className="p-4 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--goalops-text-muted)]">
                关键目标进展
              </div>
              <div className="mt-1 text-lg font-semibold">目标列表（按 KR/展示进度排序）</div>
              <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">
                {loading ? '加载中…' : rows.length ? `展示前 ${rows.length} 条` : '暂无目标'}
              </div>
            </div>
            <ButtonLink to="/objectives" variant="ghost" size="sm">
              查看全部目标
            </ButtonLink>
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-[var(--goalops-border)]">
            <table className="min-w-[940px] w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--goalops-table-header-bg)]">
                <tr className="text-xs font-semibold text-[var(--goalops-text-muted)]">
                  <th className="whitespace-nowrap px-5 py-3">目标名称</th>
                  <th className="whitespace-nowrap px-5 py-3">负责人</th>
                  <th className="whitespace-nowrap px-5 py-3">优先级</th>
                  <th className="whitespace-nowrap px-5 py-3">KR</th>
                  <th className="whitespace-nowrap px-5 py-3">任务</th>
                  <th className="whitespace-nowrap px-5 py-3">展示进度</th>
                  <th className="whitespace-nowrap px-5 py-3">阻塞</th>
                  <th className="whitespace-nowrap px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-[var(--goalops-text-muted)]">
                      暂无数据。可先
                      <Link className="ml-1 text-[var(--goalops-accent)] hover:underline" to="/objectives/new">
                        新建目标
                      </Link>
                      。
                    </td>
                  </tr>
                ) : null}

                {(loading ? Array.from({ length: 6 }) : rows).map((row, idx) => {
                  if (loading) {
                    return (
                      <tr key={`sk_${idx}`} className="border-t border-[var(--goalops-border)]">
                        <td colSpan={8} className="px-5 py-3">
                          <div className="h-6 animate-pulse rounded bg-[var(--goalops-surface-2)]" />
                        </td>
                      </tr>
                    )
                  }
                  const o = row as ObjectiveListRow
                  return (
                    <tr key={o.id} className="border-t border-[var(--goalops-border)]">
                      <td className="px-5 py-4">
                        <div className="font-medium">{o.name}</div>
                      </td>
                      <td className="px-5 py-4 text-[var(--goalops-text-muted)]">{o.owner_name}</td>
                      <td className="px-5 py-4">
                        <Badge tone={dashboardPriorityBadgeTone(o.priority)}>{o.priority}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-[var(--goalops-text-muted)]">
                        {o.kr_total === 0 ? (
                          <span className="text-[var(--goalops-warning)]">—</span>
                        ) : (
                          <>
                            {o.kr_completed} / {o.kr_total}
                            {o.kr_percent != null ? (
                              <span className="ml-1 tabular-nums">· {o.kr_percent}%</span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-[var(--goalops-text-muted)]">
                        {o.task_total === 0 ? (
                          '—'
                        ) : (
                          <>
                            {o.task_completed} / {o.task_total} ·{' '}
                            {Math.round((o.task_completed / o.task_total) * 100)}%
                          </>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 rounded-full bg-[var(--goalops-progress-track-bg)]">
                            <div
                              className={cn(
                                'h-2 rounded-full bg-gradient-to-r transition-[width]',
                                'from-[rgba(167,243,208,1)] via-[rgba(251,243,199,1)]',
                                'to-[rgba(254,226,226,1)] shadow-[var(--shadow-inset-strong)]'
                              )}
                              style={{ width: `${Math.min(100, Math.max(0, o.progress_display_pct))}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-xs text-[var(--goalops-text-muted)]">
                            {o.progress_display_pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-[var(--goalops-text-muted)]">
                        {o.blockers_count > 0 ? `${o.blockers_count} 条` : '无'}
                      </td>
                      <td className="px-5 py-4">
                        <ButtonLink to={`${OBJECTIVE_ROUTE}/${o.id}`} variant="ghost" size="sm">
                          查看
                        </ButtonLink>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        <div className="space-y-4">
          <DashboardCard className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--goalops-text-muted)]">
                  风险与阻塞
                </div>
                <div className="mt-1 text-lg font-semibold">需要关注的事项</div>
                <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">
                  来自目标详情中的阻塞记录（按严重度排序）
                </div>
              </div>
              <div className="grid size-10 place-items-center rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface-2)] text-[var(--goalops-text-muted)]">
                <AlarmClock className="size-5" aria-hidden />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="h-28 animate-pulse rounded-xl bg-[var(--goalops-surface-2)]" />
              ) : riskRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--goalops-border)] bg-[color-mix(in_oklab,var(--goalops-accent)_6%,transparent)] px-4 py-3 text-sm text-[var(--goalops-text-muted)]">
                  当前没有可归类的阻塞条目。
                </div>
              ) : (
                riskRows.map((r) => (
                  <div key={r.id} className={cn('rounded-xl border p-3 shadow-sm', riskTone(r.severity))}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{r.title}</div>
                        <div className="mt-1 text-xs leading-relaxed text-[var(--goalops-text-muted)]">
                          {r.desc}
                        </div>
                      </div>
                      <Badge tone={r.severity === 'high' ? 'danger' : r.severity === 'medium' ? 'warn' : 'neutral'}>
                        {riskLevelLabel(r.severity)}风险
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[var(--goalops-border)] bg-[color-mix(in_oklab,var(--goalops-accent)_6%,transparent)] p-4">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 grid size-8 place-items-center rounded-lg bg-[var(--goalops-accent-soft)] text-[var(--goalops-accent)]">
                  <Layers className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">建议动作</div>
                  <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">
                    先处理 KR 未完成项与高严重度阻塞，再同步负载与交付节奏。
                  </div>
                  <Link
                    className="mt-3 inline-flex text-xs font-semibold text-[var(--goalops-accent)] hover:underline"
                    to="/objectives"
                  >
                    进入目标工作台 →
                  </Link>
                </div>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--goalops-text-muted)]">
                  建议与快捷入口
                </div>
                <div className="mt-1 text-lg font-semibold">下一步</div>
                <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">结合 KR 与阻塞驱动的行动清单</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {suggestionItems().map((s) => (
                <Link
                  key={s.id}
                  to={s.link}
                  className="block rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface-2)] p-4 transition hover:border-[color-mix(in_oklab,var(--goalops-accent)_35%,var(--goalops-border))]"
                >
                  <div className="text-sm font-semibold">{s.title}</div>
                  <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">{s.desc}</div>
                  <div className="mt-3 text-xs font-semibold text-[var(--goalops-accent)]">前往 →</div>
                </Link>
              ))}
            </div>
          </DashboardCard>
        </div>
      </section>
    </div>
  )
}
