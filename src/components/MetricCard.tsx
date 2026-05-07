import type { ReactNode } from 'react'

type MetricCardProps = {
  label: string
  children: ReactNode
  sub?: ReactNode
  className?: string
}

export function MetricCard({ label, children, sub, className = '' }: MetricCardProps) {
  return (
    <div
      className={`flex min-h-[112px] flex-col rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-4 shadow-[var(--goalops-shadow-card)] ${className}`}
    >
      <div className="text-xs font-medium text-[var(--goalops-text-muted)]">{label}</div>
      <div className="mt-2 flex flex-1 flex-col justify-center">{children}</div>
      {sub ? <div className="mt-1 text-xs text-[var(--goalops-text-subtle)]">{sub}</div> : null}
    </div>
  )
}
