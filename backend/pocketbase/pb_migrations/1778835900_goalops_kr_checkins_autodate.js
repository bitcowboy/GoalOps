/// <reference path="../pb_data/types.d.ts" />

/**
 * kr_checkins 集合补 autodate created / updated 字段。
 * 上一个迁移 1778835800 漏加；早于本仓库其它新建集合的惯例。
 * 幂等：已存在则跳过。
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('kr_checkins')
    const names = col.fields.fieldNames()
    let mutated = false
    if (!names.includes('created')) {
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      mutated = true
    }
    if (!names.includes('updated')) {
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
      mutated = true
    }
    if (mutated) app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('kr_checkins')
      const names = col.fields.fieldNames()
      let mutated = false
      if (names.includes('updated')) {
        col.fields.removeByName('updated')
        mutated = true
      }
      if (names.includes('created')) {
        col.fields.removeByName('created')
        mutated = true
      }
      if (mutated) app.save(col)
    } catch (_) {
      /* not found */
    }
  },
)
