import type { ReactNode } from 'react'

type SectionCardProps = {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** 更小的标题区与内边距，用于长表单页面。 */
  compact?: boolean
}

/** Section wrapper with title row and optional top-right action (e.g. 查看全部). */
export function SectionCard({ title, action, children, className = '', compact = false }: SectionCardProps) {
  const headerPad = compact ? 'px-4 py-2.5' : 'px-5 py-4'
  const titleCls = compact ? 'text-sm font-semibold' : 'text-base font-semibold'
  const bodyPad = compact ? 'p-4' : 'p-5'
  return (
    <section
      className={`rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] shadow-[var(--goalops-shadow-card)] ${className}`}
    >
      <div className={`flex items-center justify-between gap-3 border-b border-[var(--goalops-border)] ${headerPad}`}>
        <h2 className={`${titleCls} text-[var(--goalops-text)]`}>{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={bodyPad}>{children}</div>
    </section>
  )
}
