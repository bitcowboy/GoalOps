type PillTone = 'high' | 'medium' | 'low' | 'neutral' | 'success' | 'warning' | 'danger'

const toneClass: Record<PillTone, string> = {
  high: 'bg-[var(--goalops-danger-soft)] text-[var(--goalops-danger)]',
  medium: 'bg-[var(--goalops-warning-soft)] text-[var(--goalops-warning)]',
  low: 'bg-slate-100 text-slate-600',
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-[var(--goalops-success-soft)] text-[var(--goalops-success)]',
  warning: 'bg-[var(--goalops-warning-soft)] text-[var(--goalops-warning)]',
  danger: 'bg-[var(--goalops-danger-soft)] text-[var(--goalops-danger)]',
}

type StatusPillProps = {
  children: string
  tone?: PillTone
  className?: string
}

export function StatusPill({ children, tone = 'neutral', className = '' }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
