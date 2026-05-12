/// <reference path="../pb_data/types.d.ts" />

/**
 * Ensure tasks.status and tasks.priority accept the canonical frontend values.
 *
 * Some local databases were created with legacy or label-only select values, so
 * create requests using `pending` / `P0` can be rejected by PocketBase.
 */
migrate(
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks')

    const canonicalStatus = ['pending', 'in_progress', 'deliver', 'review', 'done']
    const altStatusCn = ['未开始', '进行中', '交付', '验收', '完结']
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

    const st = tasks.fields.getByName('status')
    if (fieldType(st) === 'select') {
      const sf = /** @type {{ values?: unknown }} */ (st)
      const cur = flatSelectValues(sf.values)
      sf.values = uniq([...cur, ...canonicalStatus, ...altStatusCn])
    }

    const pr = tasks.fields.getByName('priority')
    if (fieldType(pr) === 'select') {
      const sf = /** @type {{ values?: unknown }} */ (pr)
      const cur = flatSelectValues(sf.values)
      sf.values = uniq([...cur, ...canonicalPriority])
    }

    app.save(tasks)
  },
  (app) => {
    void app
  },
)
