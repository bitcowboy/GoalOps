/** People 页：占用率、周负载点、头像色等纯函数（无 PocketBase 依赖）。 */

export type PeopleWeeklyDayLoad = 'low' | 'mid' | 'high'

export type PeopleRiskStatus = 'overload' | 'high_load' | 'normal'

const AVATAR_PALETTE = ['#64748b', '#7c3aed', '#2563eb', '#059669', '#ea580c', '#0d9488'] as const

function hashBucket(id: string, mod: number): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % mod
}

export function memberAvatarColor(memberId: string): string {
  return AVATAR_PALETTE[hashBucket(memberId, AVATAR_PALETTE.length)]!
}

export function utilizationRisk(utilizationPercent: number): PeopleRiskStatus {
  if (utilizationPercent > 100) return 'overload'
  if (utilizationPercent >= 90) return 'high_load'
  return 'normal'
}

export function riskStatusLabel(r: PeopleRiskStatus): string {
  if (r === 'overload') return '过载'
  if (r === 'high_load') return '高负荷'
  return '正常'
}

export function riskStatusPillTone(r: PeopleRiskStatus): 'danger' | 'warning' | 'success' {
  if (r === 'overload') return 'danger'
  if (r === 'high_load') return 'warning'
  return 'success'
}

/** 无按日负荷数据时，由成员 id 与占用率合成 7 天示意点（周一→周日）。 */
export function syntheticWeeklyLoads(memberId: string, utilizationPercent: number): PeopleWeeklyDayLoad[] {
  const out: PeopleWeeklyDayLoad[] = []
  for (let d = 0; d < 7; d++) {
    const jitter = hashBucket(`${memberId}-${d}`, 3)
    const level =
      utilizationPercent > 100
        ? 2
        : utilizationPercent >= 90
          ? 1 + (jitter > 0 ? 1 : 0)
          : utilizationPercent >= 70
            ? jitter
            : Math.min(jitter, 1)
    out.push(level >= 2 ? 'high' : level === 1 ? 'mid' : 'low')
  }
  return out
}

export function weeklyDotClass(load: PeopleWeeklyDayLoad): string {
  if (load === 'high') return 'bg-[var(--goalops-danger)]'
  if (load === 'mid') return 'bg-[var(--goalops-warning)]'
  return 'bg-[var(--goalops-success)]'
}

export function utilizationDotClass(utilizationPercent: number): string {
  if (utilizationPercent > 100) return 'bg-[var(--goalops-danger)]'
  if (utilizationPercent >= 90) return 'bg-[var(--goalops-warning)]'
  return 'bg-[var(--goalops-success)]'
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function safePercent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}
