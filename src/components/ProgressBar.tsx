type ProgressBarProps = {
  value: number
  className?: string
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[var(--goalops-primary)] transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
