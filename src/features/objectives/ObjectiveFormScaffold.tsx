import type { ReactNode } from 'react'
import { Box } from 'lucide-react'

/**
 * Objective create/edit page shell — mirrors the hero layout of ObjectiveDetailView
 * (rounded header card + vertical rhythm for metrics + contextual sections below).
 */
export type ObjectiveFormScaffoldProps = {
  /** Alerts that should appear directly under the hero (加载错误、依赖资源失败). */
  banners?: ReactNode
  /** Leading icon circle; defaults to detail-style Box glyph. */
  heroIcon?: ReactNode
  /** Title row contents (typically H1 plus StatusPills). */
  titleRow: ReactNode
  /** Supporting copy under the title (draft definition preview etc.). */
  description: ReactNode
  /** Optional meta line strip (对齐详情页的 ID / 时间 信息行）。 */
  metaLines?: ReactNode
  headerActionsRight?: ReactNode
  /** Metric cards preview row（只读草稿预览）. */
  metrics?: ReactNode
  /** Optional “context” trio under metrics（对齐详情页三块说明卡位置）. */
  contextCards?: ReactNode
  children: ReactNode
}

const defaultHeroIcon = (
  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600 ring-1 ring-orange-200/80">
    <Box className="size-6" aria-hidden />
  </span>
)

export function ObjectiveFormScaffold({
  banners,
  heroIcon,
  titleRow,
  description,
  metaLines,
  headerActionsRight,
  metrics,
  contextCards,
  children,
}: ObjectiveFormScaffoldProps) {
  return (
    <div className="space-y-6">
      <header className="rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-6 shadow-[var(--goalops-shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 gap-4">
            {heroIcon ?? defaultHeroIcon}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">{titleRow}</div>
              <div className="mt-2 text-sm leading-relaxed text-[var(--goalops-text-muted)]">{description}</div>
              {metaLines ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--goalops-text-subtle)]">{metaLines}</div>
              ) : null}
            </div>
          </div>
          {headerActionsRight ? (
            <div className="flex flex-wrap items-center gap-2">{headerActionsRight}</div>
          ) : null}
        </div>
      </header>

      {banners}
      {metrics}
      {contextCards}
      {children}
    </div>
  )
}
