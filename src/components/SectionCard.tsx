import type { ReactNode } from 'react'

type SectionCardProps = {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** Section wrapper with title row and optional top-right action (e.g. 查看全部). */
export function SectionCard({ title, action, children, className = '' }: SectionCardProps) {
  return (
    <section
      className={`rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] shadow-[var(--goalops-shadow-card)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--goalops-border)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--goalops-text)]">{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
