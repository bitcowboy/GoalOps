/// <reference path="../pb_data/types.d.ts" />

/**
 * 将原「当前阶段」含义并入 objectives.status（统一用状态下拉表达）：
 * - status 增加：exploring、planning、in_review、paused 及常见中文 value
 * - 删除 current_phase 字段（探索 / 规划 / 执行≈进行中 / 验收复盘 / 暂停 由状态体现）
 *
 * 合并取舍：原 execution 与 in_progress 合一为「进行中」；探索 / 规划 / 验收复盘 / 暂停为独立状态。
 * 幂等。
 */
migrate(
  (app) => {
    const objectives = app.findCollectionByNameOrId('objectives')
    const names = objectives.fields.fieldNames()

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
      const extra = [
        'exploring',
        'planning',
        'in_review',
        'paused',
        '探索',
        '规划中',
        '验收复盘',
        '暂停',
      ]
      sf.values = uniq([...cur, ...extra])
    }

    if (names.includes('current_phase')) {
      objectives.fields.removeByName('current_phase')
    }

    app.save(objectives)
  },
  (app) => {
    void app
  },
)
