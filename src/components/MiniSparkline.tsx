type MiniSparklineProps = {
  /** normalized 0–1 heights, left to right */
  points: number[]
  color?: string
  className?: string
}

export function MiniSparkline({
  points,
  color = '#7c3aed',
  className = '',
}: MiniSparklineProps) {
  const w = 72
  const h = 28
  const pad = 2
  if (points.length === 0) return null
  const max = Math.max(...points, 1e-6)
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const d = points
    .map((p, i) => {
      const x = pad + i * step
      const y = h - pad - (p / max) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} className={className} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
