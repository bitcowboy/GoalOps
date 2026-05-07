import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import { MetricCard, ProgressBar, StatusPill } from '@/components'
import {
  calendarInclusiveDays,
  clampPercent,
  formatDotDate,
  initialsFromName,
  objectiveStatusLabel,
  priorityPillTone,
  remainingCalendarDays,
} from '@/features/objectives/objectiveDetailUtils'
import { objectiveRecordStatusTone } from '@/features/objectives/objectiveFormTokens'

/** Inline validation / API error banner (matches page-level styling). */
export function ObjectiveDangerBanner({
  title,
  details,
  action,
}: {
  title: string
  details?: string
  action?: ReactNode
}) {
  return (
    <div
      className="rounded-xl border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger)]/10 px-4 py-3 text-sm text-[var(--goalops-danger)]"
      role="alert"
    >
      <p className="font-medium">{title}</p>
      {details ? <p className="mt-1 text-[var(--goalops-text-muted)]">{details}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

function FormAvatar({
  initials,
  color,
  className = 'size-11 text-sm',
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

export type ObjectiveFormMetricsPreviewProps = {
  progressFraction: number
  ownerDisplayName: string
  ownerSub?: string
  startIso: string
  dueIso: string
}

/**
 * Read-only preview row aligned with ObjectiveDetailView metric cards — driven by draft form fields.
 */
export function ObjectiveFormMetricsPreview({
  progressFraction,
  ownerDisplayName,
  ownerSub = '',
  startIso,
  dueIso,
}: ObjectiveFormMetricsPreviewProps) {
  const progress = clampPercent(progressFraction)
  const name = ownerDisplayName.trim() || '—'
  const initials = initialsFromName(name === '—' ? '' : name)
  const totalDays = calendarInclusiveDays(startIso, dueIso)
  const remain = remainingCalendarDays(dueIso)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="总体进度">
        <div className="text-3xl font-semibold tabular-nums text-[var(--goalops-text)]">{progress}%</div>
        <div className="mt-2">
          <ProgressBar value={progress} />
        </div>
      </MetricCard>
      <MetricCard label="负责人">
        <div className="flex items-center gap-3">
          <FormAvatar initials={initials} color="#2563eb" className="size-11 text-sm" />
          <div className="min-w-0">
            <div className="truncate font-semibold text-[var(--goalops-text)]">{name}</div>
            <div className="truncate text-sm text-[var(--goalops-text-muted)]">{ownerSub.trim() || '—'}</div>
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
              {formatDotDate(startIso)} - {formatDotDate(dueIso)}
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
        <div className="mt-2 text-xs text-[var(--goalops-text-muted)]">预计完成: {formatDotDate(dueIso)}</div>
      </MetricCard>
    </div>
  )
}

type FormActionsFooterProps = {
  submitLabel: string
  busySubmitLabel: string
  submitting: boolean
  submitDisabled: boolean
  cancelHref: string
  cancelLabel: string
}

/** Bottom action row inside the form — primary + text cancel link. */
export function ObjectiveFormActionsFooter({
  submitLabel,
  busySubmitLabel,
  submitting,
  submitDisabled,
  cancelHref,
  cancelLabel,
}: FormActionsFooterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--goalops-border)] pt-6">
      <button
        type="submit"
        disabled={submitDisabled}
        className="rounded-lg bg-[var(--goalops-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? busySubmitLabel : submitLabel}
      </button>
      <Link
        to={cancelHref}
        className="rounded-lg border border-transparent px-4 py-2.5 text-sm font-medium text-[var(--goalops-text-muted)] hover:bg-slate-100 hover:text-[var(--goalops-text)]"
      >
        {cancelLabel}
      </Link>
    </div>
  )
}

/** Header toolbar button that submits an associated form by id (HTML5 association). */
export function ObjectiveHeaderSubmitButton({
  formId,
  label,
  busyLabel,
  submitting,
  disabled,
}: {
  formId: string
  label: string
  busyLabel: string
  submitting: boolean
  disabled: boolean
}) {
  return (
    <button
      type="submit"
      form={formId}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--goalops-primary)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting ? busyLabel : label}
    </button>
  )
}

/** Outline link-style control in the hero actions row (对齐详情页的次要按钮). */
export function ObjectiveHeaderOutlineLink({
  to,
  icon,
  children,
}: {
  to: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
    >
      {icon}
      {children}
    </Link>
  )
}

/** Status + priority badges for the hero row when enums are loaded. */
export function ObjectiveDraftStatusPills({
  statusValue,
  priorityValue,
}: {
  statusValue: string
  priorityValue: string
}) {
  if (!statusValue.trim() || !priorityValue.trim()) return null
  const st = objectiveRecordStatusTone(statusValue)
  const tone = st === 'success' ? 'success' : st === 'warning' ? 'warning' : 'neutral'
  return (
    <>
      <StatusPill tone={priorityPillTone(priorityValue)}>{priorityValue}</StatusPill>
      <StatusPill tone={tone}>{objectiveStatusLabel(statusValue)}</StatusPill>
    </>
  )
}
