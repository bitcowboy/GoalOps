/// <reference path="../pb_data/types.d.ts" />

/**
 * 对齐 `objectives.status` / `objectives.priority` 的 select 允许值：
 *
 * 若在 Admin 手工建表或改表，可能只保留中文展示值等，API 会拒绝 `in_progress`、`P0` 等
 * 与前端 / COLLECTIONS.md 约定的英文 code（见用户 400: Invalid value）。
 *
 * 本迁移将 **英文 code**、**常见中文别名** 与 **当前已配置的选项** 合并为去重后的列表，幂等。
 */
migrate(
  (app) => {
    const objectives = app.findCollectionByNameOrId('objectives')

    const canonicalStatus = ['draft', 'not_started', 'in_progress', 'at_risk', 'done', 'cancelled']
    /** 与 Dashboard 中文标签一致，兼容仅配置中文 value 的库 */
    const altStatusCn = ['草稿', '未开始', '进行中', '风险', '完成', '取消']
    const canonicalPriority = ['P0', 'P1', 'P2', 'P3']

    /**
     * @param {unknown} raw
     * @returns {string[]}
     */
    function flatSelectValues(raw) {
      if (!raw || !Array.isArray(raw)) return []
      const out = []
      for (const x of raw) {
        if (typeof x === 'string' && x) {
          out.push(x)
        } else if (x && typeof x === 'object') {
          const v = /** @type {{ value?: unknown }} */ (x).value
          if (typeof v === 'string' && v) out.push(v)
        }
      }
      return out
    }

    /**
     * @param {unknown[]} arr
     */
    function uniq(arr) {
      return [...new Set(arr.filter((s) => typeof s === 'string' && s.length > 0))]
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

    const st = objectives.fields.getByName('status')
    if (fieldType(st) === 'select') {
      const sf = /** @type {{ values?: unknown }} */ (st)
      const cur = flatSelectValues(sf.values)
      sf.values = uniq([...cur, ...canonicalStatus, ...altStatusCn])
    }

    const pr = objectives.fields.getByName('priority')
    if (fieldType(pr) === 'select') {
      const sf = /** @type {{ values?: unknown }} */ (pr)
      const cur = flatSelectValues(sf.values)
      sf.values = uniq([...cur, ...canonicalPriority])
    }

    app.save(objectives)
  },
  (app) => {
    void app
  },
)
