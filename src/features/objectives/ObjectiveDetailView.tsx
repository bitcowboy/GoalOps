import type { RecordModel } from 'pocketbase'
import {
  ArrowLeft,
  Box,
  Calendar,
  Check,
  ChevronRight,
  Circle,
  MoreHorizontal,
  Pencil,
  Square,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { MetricCard, ProgressBar, SectionCard, StatusPill } from '@/components'
import type { ObjectiveNextActionJson, ObjectivePhaseStep } from '@/models'
import {
  calendarInclusiveDays,
  clampPercent,
  editorToPlainText,
  formatDateTime,
  formatDotDate,
  initialsFromName,
  normalizeObjectiveStatusKey,
  objectiveStatusLabel,
  parseNextActions,
  parsePhaseTimeline,
  parseStringArray,
  priorityPillTone,
  remainingCalendarDays,
  taskStatusLabel,
} from '@/features/objectives/objectiveDetailUtils'

type ObjectiveDetailViewProps = {
  objective: RecordModel & { expand?: { owner?: RecordModel } }
  tasks: RecordModel[]
  deliverables: RecordModel[]
  blockers: RecordModel[]
}

function Avatar({
  initials,
  color,
  className = 'size-10 text-xs',
}: {
  initials: string
  color: string
  className?: string
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

function PhaseRing({ value }: { value: number }) {
  const pct = clampPercent(value)
  const r = 18
  const circumference = 2 * Math.PI * r
  const strokeDashoffset = circumference - (pct / 100) * circumference
  return (
    <div className="relative flex size-14 items-center justify-center" aria-hidden>
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--goalops-primary)"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="relative text-[11px] font-bold tabular-nums text-[var(--goalops-text)]">{pct}%</span>
    </div>
  )
}

function phaseStepMeta(step: ObjectivePhaseStep) {
  if (step.status === 'done') {
    return { label: `已完成 ${clampPercent(step.progress_percent ?? 100)}%`, tone: 'success' as const }
  }
  if (step.status === 'in_progress') {
    return { label: '进行中', tone: 'primary' as const }
  }
  return { label: '未开始', tone: 'muted' as const }
}

function PhaseIcon({ step }: { step: ObjectivePhaseStep }) {
  if (step.status === 'done') {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--goalops-success-soft)] text-[var(--goalops-success)]">
        <Check className="size-5" aria-hidden />
      </span>
    )
  }
  if (step.status === 'in_progress') {
    return <PhaseRing value={step.progress_percent ?? 0} />
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--goalops-border)] bg-slate-50 text-[var(--goalops-text-subtle)]">
      <Circle className="size-5" aria-hidden />
    </span>
  )
}

function DeliverableStatusTag({ status }: { status: string }) {
  const s = status.trim()
  if (s === '进行中')
    return (
      <span className="rounded-md bg-[var(--goalops-primary-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--goalops-primary)]">
        {s}
      </span>
    )
  return (
    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-[var(--goalops-text-muted)]">{s}</span>
  )
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

export function ObjectiveDetailView({
  objective: obj,
  tasks,
  deliverables,
  blockers,
}: ObjectiveDetailViewProps) {
  const owner = obj.expand?.owner as RecordModel | undefined
  const ownerName = owner ? String(owner.name ?? '') : '—'
  const ownerTeam = owner ? String(owner.team ?? '') : ''
  const ownerColor = '#2563eb'
  const ownerInitials = initialsFromName(ownerName)

  const title = String(obj.name ?? '')
  const subtitle = editorToPlainText(String(obj.definition ?? ''))
  const displayCode = String(obj.display_code ?? '').trim() || `目标 ID: ${obj.id}`
  const createdAt = formatDateTime(obj.created)
  const updatedAt = formatDateTime(obj.updated)

  const progress = clampPercent(obj.progress_percent)
  const deltaRaw = obj.progress_delta_percent
  const delta =
    typeof deltaRaw === 'number' && !Number.isNaN(deltaRaw)
      ? deltaRaw
      : deltaRaw != null && deltaRaw !== ''
        ? Number(deltaRaw)
        : null

  const statusKey = String(obj.status ?? '')
  const priorityKey = String(obj.priority ?? '')

  const start = String(obj.start_date ?? '')
  const due = String(obj.due_date ?? '')
  const totalDays = calendarInclusiveDays(start, due)
  const remain = remainingCalendarDays(due)

  const background = String(obj.background ?? '').trim()
  const successList = parseStringArray(obj.success_criteria)
  const outList = parseStringArray(obj.out_of_scope)
  const phases = parsePhaseTimeline(obj.phase_timeline)
  const nextActions = parseNextActions(obj.next_actions)

  const sk = normalizeObjectiveStatusKey(statusKey)
  const statusTone =
    sk === 'in_progress' || sk === 'in_review'
      ? ('success' as const)
      : sk === 'paused'
        ? ('warning' as const)
        : ('neutral' as const)

  const priorityTone = priorityPillTone(priorityKey)

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-6 shadow-[var(--goalops-shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 ring-1 ring-orange-200/80">
              <Box className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-[var(--goalops-text)] md:text-2xl">{title}</h1>
                <StatusPill tone={priorityTone}>{priorityKey}</StatusPill>
                <StatusPill tone={statusTone}>{objectiveStatusLabel(statusKey)}</StatusPill>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--goalops-text-muted)]">{subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--goalops-text-subtle)]">
                <span>
                  目标 ID: <span className="font-medium text-[var(--goalops-text-muted)]">{displayCode}</span>
                </span>
                <span>
                  创建时间: <span className="font-medium text-[var(--goalops-text-muted)]">{createdAt}</span>
                </span>
                <span>
                  最后更新: <span className="font-medium text-[var(--goalops-text-muted)]">{updatedAt}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/objectives/${obj.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
            >
              <Pencil className="size-4 text-[var(--goalops-text-muted)]" aria-hidden />
              编辑目标
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
            >
              更多
              <MoreHorizontal className="size-4 text-[var(--goalops-text-muted)]" aria-hidden />
            </button>
            <Link
              to="/objectives"
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--goalops-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              <ArrowLeft className="size-4" aria-hidden />
              返回目标列表
            </Link>
          </div>
        </div>
      </header>

      {/* Summary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="总体进度">
          <div className="text-3xl font-semibold tabular-nums text-[var(--goalops-text)]">{progress}%</div>
          <div className="mt-2 space-y-2">
            <ProgressBar value={progress} />
            {delta != null && !Number.isNaN(delta) ? (
              <span className="inline-flex rounded-md bg-[var(--goalops-success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--goalops-success)]">
                较上周 {delta >= 0 ? '+' : ''}
                {delta}%
              </span>
            ) : null}
          </div>
        </MetricCard>
        <MetricCard label="负责人">
          <div className="flex items-center gap-3">
            <Avatar initials={ownerInitials} color={ownerColor} className="size-11 text-sm" />
            <div className="min-w-0">
              <div className="truncate font-semibold text-[var(--goalops-text)]">{ownerName}</div>
              <div className="truncate text-sm text-[var(--goalops-text-muted)]">{ownerTeam || '—'}</div>
            </div>
          </div>
        </MetricCard>
        <MetricCard label="起止时间">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[var(--goalops-text-muted)]">
              <Calendar className="size-5" aria-hidden />
            </span>
            <div>
              <div className="text-sm font-semibold tabular-nums text-[var(--goalops-text)]">
                {formatDotDate(start)} - {formatDotDate(due)}
              </div>
              {totalDays != null ? (
                <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">共 {totalDays} 天</div>
              ) : (
                <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">—</div>
              )}
            </div>
          </div>
        </MetricCard>
        <MetricCard label="剩余天数">
          <div className="text-3xl font-semibold tabular-nums text-[var(--goalops-text)]">
            {remain != null ? `${remain} 天` : '—'}
          </div>
          <div className="mt-2 text-xs text-[var(--goalops-text-muted)]">
            预计完成: {formatDotDate(due)}
          </div>
        </MetricCard>
      </div>

      {/* Context */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="背景 / 价值">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--goalops-text-muted)]">
            {background || '—'}
          </p>
        </SectionCard>
        <SectionCard title="成功标准">
          {successList.length === 0 ? (
            <p className="text-sm text-[var(--goalops-text-muted)]">—</p>
          ) : (
            <ul className="space-y-3">
              {successList.map((line, i) => (
                <li key={`${i}-${line.slice(0, 12)}`} className="flex gap-2 text-sm text-[var(--goalops-text-muted)]">
                  <Check className="mt-0.5 size-4 shrink-0 text-[var(--goalops-success)]" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="不属于本目标范围">
          {outList.length === 0 ? (
            <p className="text-sm text-[var(--goalops-text-muted)]">—</p>
          ) : (
            <ul className="space-y-3">
              {outList.map((line, i) => (
                <li key={`${i}-${line.slice(0, 12)}`} className="flex gap-2 text-sm text-[var(--goalops-text-muted)]">
                  <Circle className="mt-0.5 size-4 shrink-0 text-[var(--goalops-text-subtle)]" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Phases */}
      <SectionCard title="阶段进展">
        {phases.length === 0 ? (
          <p className="text-sm text-[var(--goalops-text-muted)]">暂无阶段数据</p>
        ) : (
          <div className="flex flex-wrap items-start gap-2 lg:flex-nowrap lg:gap-1">
            {phases.map((step, idx) => {
              const meta = phaseStepMeta(step)
              return (
                <div key={`${step.title}-${idx}`} className="flex min-w-[200px] flex-1 items-start gap-2">
                  <div className="flex flex-1 flex-col items-center gap-2 rounded-xl border border-[var(--goalops-border)] bg-slate-50/40 p-4">
                    <PhaseIcon step={step} />
                    <div className="text-center">
                      <div className="text-sm font-semibold text-[var(--goalops-text)]">{step.title}</div>
                      <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">{step.date_range}</div>
                      <div
                        className={`mt-2 text-xs font-medium ${
                          meta.tone === 'success'
                            ? 'text-[var(--goalops-success)]'
                            : meta.tone === 'primary'
                              ? 'text-[var(--goalops-primary)]'
                              : 'text-[var(--goalops-text-subtle)]'
                        }`}
                      >
                        {meta.label}
                      </div>
                    </div>
                  </div>
                  {idx < phases.length - 1 ? (
                    <div className="hidden shrink-0 pt-8 text-[var(--goalops-text-subtle)] lg:block">
                      <ChevronRight className="size-5" aria-hidden />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SectionCard title="关联任务">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-[var(--goalops-border)] bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                    <th className="px-5 py-3">任务名称</th>
                    <th className="px-5 py-3">状态</th>
                    <th className="px-5 py-3">优先级</th>
                    <th className="px-5 py-3">负责人</th>
                    <th className="px-5 py-3">截止日期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--goalops-border)]">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[var(--goalops-text-muted)]">
                        暂无任务
                      </td>
                    </tr>
                  ) : (
                    tasks.map((t) => {
                      const assignee = t.expand?.assignee as RecordModel | undefined
                      const an = assignee ? String(assignee.name ?? '') : '—'
                      const ai = initialsFromName(an)
                      const st = String(t.status ?? '')
                      const pr = String(t.priority ?? '')
                      return (
                        <tr key={t.id} className="bg-[var(--goalops-surface)]">
                          <td className="px-5 py-3 font-medium text-[var(--goalops-text)]">{String(t.title ?? '')}</td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <div className="flex items-center gap-2">
                              <TaskStatusDot status={st} />
                              <span className="text-[var(--goalops-text-muted)]">{taskStatusLabel(st)}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <StatusPill tone={priorityPillTone(pr)}>{pr}</StatusPill>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-center">
                              <span title={an}>
                                <Avatar initials={ai} color="#64748b" className="size-8 text-[11px]" />
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[var(--goalops-text-muted)]">
                            {formatDotDate(String(t.due_date ?? ''))}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="核心交付件">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-[var(--goalops-border)] bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                    <th className="px-5 py-3">交付件</th>
                    <th className="px-5 py-3">版本</th>
                    <th className="px-5 py-3">计划完成日</th>
                    <th className="px-5 py-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--goalops-border)]">
                  {deliverables.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-[var(--goalops-text-muted)]">
                        暂无交付件
                      </td>
                    </tr>
                  ) : (
                    deliverables.map((row) => (
                      <tr key={row.id} className="bg-[var(--goalops-surface)]">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 font-medium text-[var(--goalops-text)]">
                            <Square className="size-4 text-[var(--goalops-text-subtle)]" aria-hidden />
                            {String(row.title ?? '')}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-[var(--goalops-text-muted)]">
                          {String(row.version ?? '—')}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-[var(--goalops-text-muted)]">
                          {formatDotDate(String(row.planned_completion_date ?? ''))}
                        </td>
                        <td className="px-5 py-3">
                          <DeliverableStatusTag status={String(row.status ?? '')} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="当前卡点">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-[var(--goalops-border)] bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                    <th className="px-5 py-3">问题描述</th>
                    <th className="px-5 py-3">影响</th>
                    <th className="px-5 py-3">责任人</th>
                    <th className="px-5 py-3">目标解决日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--goalops-border)]">
                  {blockers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-[var(--goalops-text-muted)]">
                        暂无卡点
                      </td>
                    </tr>
                  ) : (
                    blockers.map((b) => {
                      const sev = String(b.severity ?? '')
                      const ownerRec = b.expand?.owner as RecordModel | undefined
                      const on = ownerRec ? String(ownerRec.name ?? '') : '—'
                      const oi = initialsFromName(on)
                      const high = sev === 'high'
                      const medium = sev === 'medium'
                      return (
                        <tr key={b.id} className="bg-[var(--goalops-surface)]">
                          <td className="max-w-[240px] px-5 py-3 text-[var(--goalops-text-muted)]">
                            <span className="line-clamp-2">{String(b.description ?? '')}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block size-2 rounded-full ${
                                  high
                                    ? 'bg-[var(--goalops-danger)]'
                                    : medium
                                      ? 'bg-[var(--goalops-warning)]'
                                      : 'bg-[var(--goalops-text-subtle)]'
                                }`}
                                aria-hidden
                              />
                              <span className="text-[var(--goalops-text-muted)]">
                                {high ? '高' : medium ? '中' : '低'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-center">
                              <span title={on}>
                                <Avatar initials={oi} color="#64748b" className="size-8 text-[11px]" />
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[var(--goalops-text-muted)]">
                            {formatDotDate(String(b.target_resolution_date ?? ''))}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="行动建议">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-y border-[var(--goalops-border)] bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                    <th className="px-5 py-3">建议</th>
                    <th className="px-5 py-3">类型</th>
                    <th className="px-5 py-3">优先级</th>
                    <th className="px-5 py-3">提出人</th>
                    <th className="px-5 py-3">日期</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--goalops-border)]">
                  {nextActions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[var(--goalops-text-muted)]">
                        暂无建议
                      </td>
                    </tr>
                  ) : (
                    nextActions.map((a: ObjectiveNextActionJson, idx: number) => {
                      const tone = priorityPillTone(a.priority)
                      const color = a.suggester_color ?? '#64748b'
                      return (
                        <tr key={`${a.suggestion}-${idx}`} className="bg-[var(--goalops-surface)]">
                          <td className="max-w-[220px] px-5 py-3 font-medium text-[var(--goalops-text)]">
                            <span className="line-clamp-2">{a.suggestion}</span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[var(--goalops-text-muted)]">{a.type}</td>
                          <td className="px-5 py-3">
                            <StatusPill tone={tone}>{a.priority}</StatusPill>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar
                                initials={a.suggester_initials || initialsFromName(a.suggester_name)}
                                color={color}
                                className="size-8 text-[11px]"
                              />
                              <span className="truncate text-[var(--goalops-text-muted)]">{a.suggester_name}</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[var(--goalops-text-muted)]">
                            {formatDotDate(a.suggestion_date)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
