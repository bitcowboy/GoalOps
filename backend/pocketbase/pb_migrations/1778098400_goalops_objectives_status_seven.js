/// <reference path="../pb_data/types.d.ts" />

/**
 * objectives.status 收紧为 7 档（英文 code，与前端 OBJECTIVE_STATUS_VALUES 一致）：
 * not_started | explore_plan | in_progress | paused | in_review | done | cancelled
 *
 * 旧值映射：草稿/风险 → 未开始/进行中；探索与规划 → explore_plan；验收相关 → in_review。
 * 无法识别 → not_started。并替换 status 下拉允许值为上述 7 项。
 */
migrate(
  (app) => {
    const objectives = app.findCollectionByNameOrId('objectives')

    const SEVEN = [
      'not_started',
      'explore_plan',
      'in_progress',
      'paused',
      'in_review',
      'done',
      'cancelled',
    ]
    /** @type {Record<string, string>} */
    const STATUS_MAP = {
      draft: 'not_started',
      草稿: 'not_started',
      not_started: 'not_started',
      未开始: 'not_started',
      exploring: 'explore_plan',
      planning: 'explore_plan',
      explore_plan: 'explore_plan',
      探索: 'explore_plan',
      规划中: 'explore_plan',
      探索规划: 'explore_plan',
      in_progress: 'in_progress',
      进行中: 'in_progress',
      at_risk: 'in_progress',
      风险: 'in_progress',
      paused: 'paused',
      暂停: 'paused',
      in_review: 'in_review',
      验收复盘: 'in_review',
      验收: 'in_review',
      done: 'done',
      完成: 'done',
      cancelled: 'cancelled',
      取消: 'cancelled',
    }
    const sevenSet = new Set(SEVEN)

    /**
     * @param {unknown} raw
     * @returns {string}
     */
    function normalizeStatus(raw) {
      const k = String(raw ?? '').trim()
      if (!k) return 'not_started'
      if (STATUS_MAP[k]) return STATUS_MAP[k]
      if (sevenSet.has(k)) return k
      return 'not_started'
    }

    /**
     * @param {unknown} field
     */
    function fieldType(field) {
      if (!field || typeof field !== 'object') return ''
      const f = /** @type {{ type?: unknown }} */ (field)
      if (typeof f.type === 'function') {
        try {
          return String(f.type.call(field))
        } catch (_) {
          return ''
        }
      }
      if (typeof f.type === 'string') return f.type
      return ''
    }

    try {
      const rows = app.findRecordsByFilter(objectives.id, '', '', 0, 0)
      for (const r of rows) {
        if (!r) continue
        const cur = String(r.get('status') ?? '').trim()
        const next = normalizeStatus(cur)
        if (next !== cur) {
          r.set('status', next)
          app.save(r)
        }
      }
    } catch (e) {
      console.error('1778098400 goalops objectives status seven: record backfill', e)
    }

    const st = objectives.fields.getByName('status')
    if (fieldType(st) === 'select') {
      const sf = /** @type {{ values?: unknown }} */ (st)
      sf.values = [...SEVEN]
    }

    app.save(objectives)
  },
  (app) => {
    void app
  },
)
