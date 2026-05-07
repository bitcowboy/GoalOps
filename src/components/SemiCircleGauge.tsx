type SemiCircleGaugeProps = {
  value: number
  /** stroke color — CSS color */
  accent: string
  className?: string
}

/** Lightweight semi-circle progress for KPI cards (matches screenshot rings). */
export function SemiCircleGauge({ value, accent, className = '' }: SemiCircleGaugeProps) {
  const pct = Math.min(100, Math.max(0, value))
  const r = 36
  const cx = 44
  const cy = 44
  const stroke = 6
  const circumference = Math.PI * r
  const dash = (pct / 100) * circumference

  return (
    <svg
      width="88"
      height="52"
      viewBox="0 0 88 52"
      className={className}
      aria-hidden
    >
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
      />
    </svg>
  )
}
