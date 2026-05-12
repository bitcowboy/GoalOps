import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

export function DashboardCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] shadow-[var(--goalops-shadow-card)]',
        className,
      )}
    >
      {children}
    </section>
  )
}

const badgeToneClass: Record<'danger' | 'warn' | 'neutral', string> = {
  danger:
    'border border-[rgba(248,113,113,0.35)] bg-[var(--goalops-danger-soft)] text-[var(--goalops-danger)]',
  warn: 'border border-[rgba(245,158,11,0.35)] bg-[var(--goalops-warning-soft)] text-[var(--goalops-warning)]',
  neutral:
    'border border-[var(--goalops-border)] bg-[var(--goalops-surface-2)] text-[var(--goalops-text-muted)]',
}

export function Badge({
  tone,
  className,
  children,
}: {
  tone: keyof typeof badgeToneClass
  className?: string
  children: ReactNode
}) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', badgeToneClass[tone], className)}>
      {children}
    </span>
  )
}

export function ButtonLink({
  to,
  variant,
  size = 'md',
  className,
  children,
}: {
  to: string
  variant: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  className?: string
  children: ReactNode
}) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition hover:opacity-95'
  const sizes = size === 'sm' ? 'px-3 py-2 text-sm' : 'px-4 py-2.5 text-sm'
  const variants =
    variant === 'primary'
      ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
      : variant === 'secondary'
        ? 'border border-[var(--goalops-border)] bg-[var(--goalops-surface)] text-[var(--goalops-text)] shadow-sm hover:bg-slate-50'
        : 'text-[var(--goalops-text-muted)] hover:bg-slate-100 hover:text-[var(--goalops-text)]'
  return (
    <Link to={to} className={cn(base, sizes, variants, className)}>
      {children}
    </Link>
  )
}
