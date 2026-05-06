import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { RecordModel } from 'pocketbase'
import { pb } from '@/services/pocketbase'

function editorToPlainText(html: string) {
  if (!html.includes('<')) return html
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent?.trim() ?? ''
}

/** 目标详情 — 对应 PRD `/objectives/:id` */
export function ObjectiveDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [rec, setRec] = useState<RecordModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    void (async () => {
      setLoading(true)
      try {
        const r = await pb.collection('objectives').getOne(id, { expand: 'owner' })
        if (!cancelled) {
          setRec(r)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setRec(null)
          setError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  const owner = rec?.expand?.owner as RecordModel | undefined

  if (!id) {
    return (
      <p className="text-sm text-amber-700" role="alert">
        路由缺少目标 ID。
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <Link className="text-slate-700 underline-offset-4 hover:underline" to="/">
          ← 返回看板
        </Link>
        <span className="font-mono text-xs text-slate-400">{id}</span>
      </div>

      {loading && <p className="text-sm text-slate-500">加载中…</p>}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {rec && (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{String(rec.name ?? '')}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {editorToPlainText(String(rec.definition ?? ''))}
            </p>
          </div>
          <dl className="grid max-w-lg grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">进度</dt>
            <dd>{rec.progress_percent ?? '—'}%</dd>
            <dt className="text-slate-500">状态</dt>
            <dd>{String(rec.status ?? '')}</dd>
            <dt className="text-slate-500">优先级</dt>
            <dd>{String(rec.priority ?? '')}</dd>
            <dt className="text-slate-500">负责人</dt>
            <dd>{owner ? String(owner.name ?? '') : '—'}</dd>
            <dt className="text-slate-500">开始</dt>
            <dd>{String(rec.start_date ?? '') || '—'}</dd>
            <dt className="text-slate-500">截止</dt>
            <dd>{String(rec.due_date ?? '') || '—'}</dd>
          </dl>
          <p className="text-sm text-slate-500">
            交付件、任务、卡点、文档等模块可在同页后续加载关联集合。
          </p>
        </>
      )}
    </div>
  )
}
