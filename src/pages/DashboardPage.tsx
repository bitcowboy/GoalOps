import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { RecordModel } from 'pocketbase'
import { pb } from '@/services/pocketbase'
import { useAppStore } from '@/store/useAppStore'

/** 部门整体看板 — 对应 PRD `/` */
export function DashboardPage() {
  const pbUrl = useAppStore((s) => s.pocketBaseUrl)
  const [items, setItems] = useState<RecordModel[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const list = await pb.collection('objectives').getFullList({
          sort: 'name',
          expand: 'owner',
        })
        if (!cancelled) {
          setItems(list)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">部门整体看板</h1>
        <p className="mt-1 text-sm text-slate-600">
          目标列表来自 PocketBase；后续在此扩展指标、风险与行动建议。
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p className="text-slate-500">
          PocketBase URL：<span className="font-mono text-slate-800">{pbUrl}</span>
        </p>
        {loading && <p className="mt-3 text-slate-500">加载目标中…</p>}
        {error && (
          <p className="mt-3 text-red-600" role="alert">
            无法连接 PocketBase：{error}。请确认已执行 <code className="rounded bg-slate-100 px-1">pocketbase.exe serve</code>{' '}
            且已完成迁移。
          </p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="mt-3 text-amber-700">暂无目标记录。请运行迁移与种子脚本（见 README）。</p>
        )}
        {!loading && items.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100">
            {items.map((o) => {
              const owner = o.expand?.owner as RecordModel | undefined
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link
                      className="font-medium text-slate-900 underline-offset-4 hover:underline"
                      to={`/objectives/${o.id}`}
                    >
                      {String(o.name ?? '')}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>进度 {o.progress_percent ?? '—'}%</span>
                      <span>状态 {String(o.status ?? '')}</span>
                      <span>优先级 {String(o.priority ?? '')}</span>
                      {owner && <span>负责人 {String(owner.name ?? '')}</span>}
                    </div>
                  </div>
                  <Link
                    className="shrink-0 text-sm text-slate-600 underline-offset-4 hover:underline"
                    to={`/objectives/${o.id}`}
                  >
                    详情
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
