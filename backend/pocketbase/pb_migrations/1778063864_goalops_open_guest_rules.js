/// <reference path="../pb_data/types.d.ts" />

/**
 * MVP 开发环境：允许访客对业务集合执行列表/读写（生产环境必须改为鉴权规则）。
 */
migrate(
  (app) => {
    const names = [
      'members',
      'objectives',
      'tasks',
      'deliverables',
      'core_documents',
      'blockers',
    ]
    for (const name of names) {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = '1=1'
      col.viewRule = '1=1'
      col.createRule = '1=1'
      col.updateRule = '1=1'
      col.deleteRule = '1=1'
      app.save(col)
    }
  },
  (app) => {
    const names = [
      'members',
      'objectives',
      'tasks',
      'deliverables',
      'core_documents',
      'blockers',
    ]
    for (const name of names) {
      const col = app.findCollectionByNameOrId(name)
      col.listRule = ''
      col.viewRule = ''
      col.createRule = ''
      col.updateRule = ''
      col.deleteRule = ''
      app.save(col)
    }
  },
)
