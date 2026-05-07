import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Clock,
  Download,
  Flag,
  Info,
  MoreHorizontal,
  Search,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { MetricCard, SectionCard, SemiCircleGauge, StatusPill } from '@/components'
import {
  fetchPeopleBoard,
  type PeopleBoardPayload,
  type PeopleBoardRow,
  type PeopleInsightCard,
  type PeopleInsightMemberSample,
} from '@/features/people'
import {
  riskStatusLabel,
  riskStatusPillTone,
  utilizationDotClass,
  weeklyDotClass,
} from '@/features/people/peopleUtils'

type SortKey = 'utilization' | 'tasks' | 'name'

function TimeAllocationBar({ row }: { row: PeopleBoardRow }) {
  const sum = Math.max(row.hoursObjectiveWork + row.hoursMeeting + row.hoursMisc, 0.1)
  const pObj = Math.round((row.hoursObjectiveWork / sum) * 100)
  const pMeet = Math.round((row.hoursMeeting / sum) * 100)
  const pMisc = Math.max(100 - pObj - pMeet, 0)
  const label = `${row.hoursObjectiveWork || 0}h / ${row.hoursMeeting || 0}h / ${row.hoursMisc || 0}h`
  return (
    <div className="min-w-[140px] max-w-[200px]">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {pObj > 0 ? (
          <span
            className="bg-[var(--goalops-primary)]"
            style={{ width: `${pObj}%` }}
            title="目标任务"
            aria-hidden
          />
        ) : null}
        {pMeet > 0 ? (
          <span className="bg-amber-500" style={{ width: `${pMeet}%` }} title="会议" aria-hidden />
        ) : null}
        {pMisc > 0 ? (
          <span className="bg-slate-300" style={{ width: `${pMisc}%` }} title="杂事" aria-hidden />
        ) : null}
      </div>
      <div className="mt-1 text-[11px] text-[var(--goalops-text-subtle)]">目标任务 / 会议 / 杂事</div>
      <div className="tabular-nums text-xs font-medium text-[var(--goalops-text)]">{label}</div>
    </div>
  )
}

function InsightMiniCard({
  card,
}: {
  card: PeopleInsightCard
}) {
  return (
    <div className="flex flex-col rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-4 shadow-[var(--goalops-shadow-card)]">
      <div className="text-sm font-semibold text-[var(--goalops-text)]">{card.title}</div>
      <div className="mt-2 text-xl font-semibold tabular-nums text-[var(--goalops-text)]">{card.countLabel}</div>
      <p className="mt-1 text-xs leading-relaxed text-[var(--goalops-text-muted)]">{card.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1">
        {card.members.map((m) => (
          <AvatarChip key={m.id} m={m} />
        ))}
        {card.members.length === 0 ? (
          <span className="text-xs text-[var(--goalops-text-subtle)]">暂无示例成员</span>
        ) : null}
      </div>
      <button
        type="button"
        className="mt-3 self-start text-xs font-semibold text-[var(--goalops-primary)] hover:underline"
      >
        查看详情
      </button>
    </div>
  )
}

function AvatarChip({ m }: { m: PeopleInsightMemberSample }) {
  return (
    <span
      className="flex size-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: m.color }}
      title={m.name}
    >
      {m.initials}
    </span>
  )
}

function exportPeopleCsv(rows: PeopleBoardRow[]) {
  const headers = [
    '成员',
    '角色',
    '小组',
    '主目标',
    '进度%',
    '任务数',
    '目标任务工时',
    '会议工时',
    '杂事工时',
    '占用率%',
  ]
  const lines = rows.map((r) =>
    [r.name, r.role, r.team, r.mainObjectiveName, r.mainObjectiveProgress, r.activeTaskCount, r.hoursObjectiveWork, r.hoursMeeting, r.hoursMisc, r.utilizationPercent]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  )
  const csv = [headers.join(','), ...lines].join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `goalops-members-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** 人员页 — 对齐 PRD `/people` UI，数据源自 PocketBase。 */
export function PeoplePage() {
  const [data, setData] = useState<PeopleBoardPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('utilization')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = await fetchPeopleBoard()
      setData(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filteredSortedRows = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    let rows = [...data.rows]
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.role.toLowerCase().includes(q) ||
          r.team.toLowerCase().includes(q) ||
          r.mainObjectiveName.toLowerCase().includes(q),
      )
    }
    rows.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'zh-CN')
      if (sortKey === 'tasks') return b.activeTaskCount - a.activeTaskCount || b.utilizationPercent - a.utilizationPercent
      return b.utilizationPercent - a.utilizationPercent || a.name.localeCompare(b.name, 'zh-CN')
    })
    return rows
  }, [data, query, sortKey])

  const kpis = data?.kpis

  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--goalops-text)]">人员</h1>
          <button
            type="button"
            className="mt-1 text-[var(--goalops-text-subtle)] hover:text-[var(--goalops-text)]"
            aria-label="说明"
          >
            <Info className="size-5" aria-hidden />
          </button>
        </div>
        <div className="relative w-full min-w-[200px] max-w-md flex-1 sm:max-w-lg">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--goalops-text-subtle)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索成员、角色、技能或团队"
            className="w-full rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface)] py-2.5 pl-10 pr-4 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] placeholder:text-[var(--goalops-text-subtle)] focus:ring-2"
          />
        </div>
      </header>

      {error ? (
        <div
          className="rounded-[var(--goalops-radius-card)] border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger-soft)] px-4 py-3 text-sm text-[var(--goalops-danger)]"
          role="alert"
        >
          <p className="font-medium">无法加载人员数据</p>
          <p className="mt-1 text-[var(--goalops-text-muted)]">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 text-sm font-semibold text-[var(--goalops-primary)] hover:underline"
          >
            重试
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-[var(--goalops-text-muted)]">正在从 PocketBase 加载…</p>
      ) : null}

      {kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="团队人数" sub="实时汇总">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Users className="size-6" aria-hidden />
                </span>
                <span className="text-3xl font-semibold tabular-nums">{kpis.teamSize}</span>
              </div>
            </div>
          </MetricCard>
          <MetricCard label="平均占用率" sub="基于成员周可用工时">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-3xl font-semibold tabular-nums">{kpis.avgUtilization}%</div>
              </div>
              <SemiCircleGauge value={kpis.avgUtilization} accent="var(--goalops-primary)" />
            </div>
          </MetricCard>
          <MetricCard label="过载成员" sub={`占比 ${kpis.overloadedPct}%`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--goalops-danger-soft)] text-[var(--goalops-danger)]">
                  <AlertTriangle className="size-6" aria-hidden />
                </span>
                <span className="text-3xl font-semibold tabular-nums text-[var(--goalops-danger)]">
                  {kpis.overloadedCount}
                </span>
              </div>
            </div>
          </MetricCard>
          <MetricCard label="关键路径负责人" sub={`占比 ${kpis.criticalPathOwnersPct}%`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Flag className="size-6" aria-hidden />
                </span>
                <span className="text-3xl font-semibold tabular-nums">{kpis.criticalPathOwnersCount}</span>
              </div>
            </div>
          </MetricCard>
          <MetricCard label="本周会议时长" sub="misc_work · meeting">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Clock className="size-6" aria-hidden />
                </span>
                <span className="text-3xl font-semibold tabular-nums">{kpis.weeklyMeetingHoursTotal} h</span>
              </div>
            </div>
          </MetricCard>
        </div>
      ) : null}

      {data ? (
        <SectionCard
          title={`成员列表 (${filteredSortedRows.length})`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="appearance-none rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] py-2 pl-3 pr-9 text-sm font-medium text-[var(--goalops-text)]"
                  aria-label="排序"
                >
                  <option value="utilization">按占用率排序</option>
                  <option value="tasks">按任务数排序</option>
                  <option value="name">按姓名排序</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--goalops-text-muted)]" />
              </div>
              <button
                type="button"
                onClick={() => exportPeopleCsv(filteredSortedRows)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
              >
                <Download className="size-4" aria-hidden />
                导出
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--goalops-border)] text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                  <th className="pb-3 pr-3 font-medium normal-case">成员信息</th>
                  <th className="pb-3 pr-3 font-medium normal-case">当前主要目标</th>
                  <th className="pb-3 pr-3 font-medium normal-case tabular-nums">当前任务数</th>
                  <th className="pb-3 pr-6 font-medium normal-case">时间分配</th>
                  <th className="pb-3 pr-3 font-medium normal-case">占用率</th>
                  <th className="pb-3 pr-3 font-medium normal-case">
                    <div className="flex flex-wrap items-center gap-1 normal-case tracking-normal">
                      {weekDays.map((d) => (
                        <span key={d} className="inline-block min-w-[2rem] text-center text-[11px]">
                          {d}
                        </span>
                      ))}
                    </div>
                  </th>
                  <th className="pb-3 pr-3 font-medium normal-case">风险状态</th>
                  <th className="pb-3 font-medium normal-case text-right"> </th>
                </tr>
              </thead>
              <tbody className="text-[var(--goalops-text)]">
                {filteredSortedRows.map((row) => (
                  <tr
                    key={row.memberId}
                    className="border-b border-[var(--goalops-border)]/80 hover:bg-slate-50/80"
                  >
                    <td className="py-3 pr-3 align-middle">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: row.avatarColor }}
                        >
                          {row.initials}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{row.name}</div>
                          <div className="truncate text-xs text-[var(--goalops-text-muted)]">{row.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] py-3 pr-3 align-middle">
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-1.5 inline-block size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.mainObjectiveDotColor }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium" title={row.mainObjectiveName}>
                            {row.mainObjectiveName}
                          </div>
                          <div className="mt-0.5 tabular-nums text-xs text-[var(--goalops-text-muted)]">
                            完成度 {Math.min(row.mainObjectiveProgress, 100)}%
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-middle tabular-nums">{row.activeTaskCount}</td>
                    <td className="py-3 pr-6 align-middle">
                      <TimeAllocationBar row={row} />
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block size-2 shrink-0 rounded-full ${utilizationDotClass(row.utilizationPercent)}`}
                          aria-hidden
                        />
                        <span className="tabular-nums font-medium">{row.utilizationPercent}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <div className="flex items-center gap-1">
                        {row.weeklyDots.map((d, i) => (
                          <span
                            key={i}
                            className={`inline-block size-2.5 rounded-full ${weeklyDotClass(d)}`}
                            title={`${weekDays[i]}`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 pr-3 align-middle">
                      <StatusPill tone={riskStatusPillTone(row.risk)}>{riskStatusLabel(row.risk)}</StatusPill>
                    </td>
                    <td className="py-3 align-middle text-right">
                      <button
                        type="button"
                        className="rounded-lg border border-transparent p-1.5 text-[var(--goalops-text-muted)] hover:bg-slate-100 hover:text-[var(--goalops-text)]"
                        aria-label="更多操作"
                      >
                        <MoreHorizontal className="size-5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredSortedRows.length ? (
              <p className="py-10 text-center text-sm text-[var(--goalops-text-muted)]">
                {query ? '没有匹配的成员。' : '暂无成员数据。'}
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {data ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="size-5 text-[var(--goalops-text-muted)]" aria-hidden />
            <h2 className="text-base font-semibold text-[var(--goalops-text)]">风险洞察</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.insights.map((c) => (
              <InsightMiniCard key={c.kind} card={c} />
            ))}
          </div>
        </section>
      ) : null}

      {loading && data ? (
        <p className="text-xs text-[var(--goalops-text-subtle)]">正在刷新…</p>
      ) : null}
    </div>
  )
}
