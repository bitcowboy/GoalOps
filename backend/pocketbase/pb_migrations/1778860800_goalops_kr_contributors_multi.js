/// <reference path="../pb_data/types.d.ts" />

/**
 * 修复：1778835800 migration 里 `key_results.contributors` 的 `maxSelect: 0`
 * 在 PB v0.23 实际被当成单选（只能存 1 个 id）。改为多选。
 *
 * 实测：通过 MCP / HTTP 传 ["a","b"] 时，旧 schema 只保留最后一个 id。
 * 把 maxSelect 改成 999 即变成「无实际上限的多选」。
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('key_results')
    const field = col.fields.getByName('contributors')
    if (!field) return
    field.maxSelect = 999
    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('key_results')
      const field = col.fields.getByName('contributors')
      if (field) {
        field.maxSelect = 0
        app.save(col)
      }
    } catch (_) {
      /* no-op */
    }
  },
)
