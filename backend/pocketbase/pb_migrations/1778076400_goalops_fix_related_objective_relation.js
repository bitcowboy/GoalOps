/// <reference path="../pb_data/types.d.ts" />

/**
 * 修复：部分本地库仅有 `blockers` / `core_documents` / `deliverables` / `tasks` 壳表，
 * 缺少指向 `objectives` 的 `objective` relation，API filter `objective="..."` 会报 unknown field。
 * 幂等：已存在 `objective` 则跳过。
 */
migrate(
  (app) => {
    const objectives = app.findCollectionByNameOrId('objectives')

    /**
     * @param {string} collectionName
     * @param {boolean} cascadeDelete
     */
    const ensureObjectiveRelation = (collectionName, cascadeDelete) => {
      const col = app.findCollectionByNameOrId(collectionName)
      const fieldNames = col.fields.fieldNames()
      if (fieldNames.includes('objective')) return

      col.fields.add(
        new RelationField({
          name: 'objective',
          required: true,
          maxSelect: 1,
          collectionId: objectives.id,
          cascadeDelete,
        }),
      )
      app.save(col)
    }

    ensureObjectiveRelation('tasks', true)
    ensureObjectiveRelation('deliverables', true)
    ensureObjectiveRelation('core_documents', true)
    ensureObjectiveRelation('blockers', true)
  },
  (app) => {
    void app
  },
)
