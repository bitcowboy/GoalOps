/// <reference path="../pb_data/types.d.ts" />

/**
 * 「创建目标」扩展字段：一句话定义、参与成员、当前阶段、风险草稿、卡点摘要、草稿交付件/核心文档；
 * 并合并 objectives.status 的 draft（草稿）选项。
 *
 * 幂等：字段已存在则跳过；status select 取值合并去重。
 */
migrate(
  (app) => {
    const objectives = app.findCollectionByNameOrId('objectives')
    const names = objectives.fields.fieldNames()

    if (!names.includes('one_sentence_definition')) {
      objectives.fields.add(
        new TextField({
          name: 'one_sentence_definition',
          max: 512,
          required: false,
        }),
      )
    }

    if (!names.includes('participant_ids')) {
      objectives.fields.add(
        new JSONField({
          name: 'participant_ids',
          maxSize: 200000,
        }),
      )
    }

    if (!names.includes('current_phase')) {
      objectives.fields.add(
        new SelectField({
          name: 'current_phase',
          required: false,
          maxSelect: 1,
          values: [
            { value: 'discovery', text: '探索' },
            { value: 'planning', text: '立项与规划' },
            { value: 'execution', text: '推进执行' },
            { value: 'review', text: '验收与复盘' },
            { value: 'paused', text: '暂停' },
          ],
        }),
      )
    }

    if (!names.includes('risk_level')) {
      objectives.fields.add(
        new SelectField({
          name: 'risk_level',
          required: false,
          maxSelect: 1,
          values: [
            { value: 'low', text: '低' },
            { value: 'medium', text: '中' },
            { value: 'high', text: '高' },
          ],
        }),
      )
    }

    if (!names.includes('current_blockers_summary')) {
      objectives.fields.add(
        new TextField({
          name: 'current_blockers_summary',
          max: 20000,
          required: false,
        }),
      )
    }

    if (!names.includes('draft_deliverables')) {
      objectives.fields.add(
        new JSONField({
          name: 'draft_deliverables',
          maxSize: 200000,
        }),
      )
    }

    if (!names.includes('draft_core_documents')) {
      objectives.fields.add(
        new JSONField({
          name: 'draft_core_documents',
          maxSize: 200000,
        }),
      )
    }

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
      const extra = ['draft', '草稿']
      sf.values = uniq([...cur, ...extra])
    }

    app.save(objectives)
  },
  (app) => {
    void app
  },
)
