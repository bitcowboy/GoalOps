import { Fragment, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { KRCheckin, KRType } from '../../models'
import { checkinTypeLabel, statusSignalDot, statusSignalLabel } from './statusSignal'

type CheckinTimelineProps = {
  checkins: KRCheckin[]
  krType: KRType
  krDirection?: 'increase' | 'decrease' | null
  memberNameById: Record<string, string>
  unit?: string
  emptyCtaLabel?: string
  onCreate: () => void
  onEdit: (c: KRCheckin) => void
  onDelete: (c: KRCheckin) => void
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

function formatDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function valueForCheckin(c: KRCheckin, krType: KRType): number | null {
  if (krType === 'metric') return c.currentValue ?? null
  if (krType === 'milestone') return c.progressPercent ?? null
  // checkbox
  if (c.isCompleted === true) return 100
  if (c.isCompleted === false) return 0
  return null
}

export function CheckinTimeline({
  checkins,
  krType,
  krDirection,
  memberNameById,
  unit,
  emptyCtaLabel = '为这个 KR 创建第一条 check-in',
  onCreate,
  onEdit,
  onDelete,
}: CheckinTimelineProps) {
  const [showAll, setShowAll] = useState(false)
  const ordered = useMemo(() => {
    return [...checkins].sort((a, b) => {
      if (a.checkinDate !== b.checkinDate) return a.checkinDate < b.checkinDate ? 1 : -1
      const ac = a.created ?? ''
      const bc = b.created ?? ''
      return ac < bc ? 1 : ac > bc ? -1 : 0
    })
  }, [checkins])

  const visible = showAll ? ordered : ordered.slice(0, 5)

  if (ordered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--goalops-border)] bg-slate-50/60 p-6 text-center">
        <p className="text-sm text-[var(--goalops-text-muted)]">还没有 check-in 记录。</p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--goalops-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
        >
          <Plus className="size-3.5" aria-hidden />
          {emptyCtaLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--goalops-text-muted)]">
          共 {ordered.length} 条 · 最近 {Math.min(ordered.length, visible.length)} 条
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--goalops-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
        >
          <Plus className="size-3.5" aria-hidden />
          + Check-in
        </button>
      </div>

      <ol className="relative mt-4 space-y-4 sm:before:absolute sm:before:left-[7px] sm:before:top-2 sm:before:bottom-2 sm:before:w-px sm:before:bg-[var(--goalops-border)]">
        {visible.map((c, idx) => {
          const prev = visible[idx + 1]
          const v = valueForCheckin(c, krType)
          const pv = prev ? valueForCheckin(prev, krType) : null
          const delta = v != null && pv != null ? v - pv : null
          // 对于 decrease direction，下降是「好」
          const deltaTone =
            delta == null || delta === 0
              ? 'text-[var(--goalops-text-subtle)]'
              : (krDirection === 'decrease' ? delta < 0 : delta > 0)
                ? 'text-[var(--goalops-success)]'
                : 'text-[var(--goalops-danger)]'
          const deltaSign = delta == null ? '' : delta > 0 ? '+' : ''

          const authorName = memberNameById[c.authorId] ?? c.authorId

          return (
            <li key={c.id} className="relative sm:pl-7">
              <span
                className={`hidden size-3.5 rounded-full ring-2 ring-white sm:absolute sm:left-0 sm:top-1.5 sm:block ${statusSignalDot(c.statusSignal)}`}
                aria-hidden
              />
              <article className="rounded-xl border border-[var(--goalops-border)] bg-white p-3 shadow-sm">
                <header className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex size-2.5 rounded-full sm:hidden ${statusSignalDot(c.statusSignal)}`}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-[var(--goalops-text)]">{formatDate(c.checkinDate)}</span>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-[var(--goalops-text-muted)]">
                    {checkinTypeLabel(c.checkinType)}
                  </span>
                  <span className="text-[11px] text-[var(--goalops-text-muted)]">
                    信心 <span className="font-semibold text-[var(--goalops-text)]">{c.confidence}</span>
                  </span>
                  <span className="text-[11px] text-[var(--goalops-text-muted)]">
                    · {statusSignalLabel(c.statusSignal)}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      className="rounded p-1 text-[var(--goalops-text-muted)] hover:bg-slate-100"
                      title="编辑"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(c)}
                      className="rounded p-1 text-[var(--goalops-text-muted)] hover:bg-[var(--goalops-danger-soft)] hover:text-[var(--goalops-danger)]"
                      title="删除"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </header>

                {v != null ? (
                  <div className="mt-1 text-xs text-[var(--goalops-text-muted)]">
                    {krType === 'metric' ? (
                      <>
                        current_value:{' '}
                        <span className="font-semibold text-[var(--goalops-text)]">{v}</span>
                        {unit ? ` ${unit}` : ''}
                      </>
                    ) : krType === 'milestone' ? (
                      <>
                        进度:{' '}
                        <span className="font-semibold text-[var(--goalops-text)]">{v}%</span>
                      </>
                    ) : (
                      <>
                        是否完成:{' '}
                        <span className="font-semibold text-[var(--goalops-text)]">
                          {c.isCompleted ? '是' : '否'}
                        </span>
                      </>
                    )}
                    {delta != null ? (
                      <span className={`ml-2 ${deltaTone}`}>
                        {deltaSign}
                        {delta} from prev
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--goalops-text)]">{c.progressNote}</p>

                {c.blockersNote ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--goalops-text-muted)]">
                    <span className="font-semibold">阻塞：</span>
                    {c.blockersNote}
                  </p>
                ) : null}
                {c.nextFocus ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--goalops-text-muted)]">
                    <span className="font-semibold">下周聚焦：</span>
                    {c.nextFocus}
                  </p>
                ) : null}

                <footer className="mt-2 text-[11px] text-[var(--goalops-text-subtle)]">
                  by {authorName}
                  {c.created ? <Fragment> · {formatDateTime(c.created)}</Fragment> : null}
                </footer>
              </article>
            </li>
          )
        })}
      </ol>

      {ordered.length > 5 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs font-medium text-[var(--goalops-primary)] hover:underline"
        >
          {showAll ? '收起' : `查看全部 (${ordered.length} 条)`}
        </button>
      ) : null}
    </div>
  )
}
