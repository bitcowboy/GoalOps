/// <reference path="../pb_data/types.d.ts" />

/**
 * Key Result（Checkbox 完成项）、任务可选关联 KR、成员在岗状态。
 * 幂等：集合/字段已存在则跳过。
 */
migrate(
  (app) => {
    const open = ''

    const objectives = app.findCollectionByNameOrId('objectives')
    const members = app.findCollectionByNameOrId('members')
    const tasks = app.findCollectionByNameOrId('tasks')

    let keyResultsCol
    try {
      keyResultsCol = app.findCollectionByNameOrId('key_results')
    } catch (_) {
      keyResultsCol = null
    }

    if (!keyResultsCol) {
      keyResultsCol = new Collection({
        type: 'base',
        name: 'key_results',
        listRule: open,
        viewRule: open,
        createRule: open,
        updateRule: open,
        deleteRule: open,
        fields: [
          {
            type: 'relation',
            name: 'objective',
            required: true,
            maxSelect: 1,
            collectionId: objectives.id,
            cascadeDelete: true,
            presentable: true,
          },
          { type: 'text', name: 'name', required: true, max: 2000 },
          { type: 'bool', name: 'is_completed' },
          {
            type: 'relation',
            name: 'owner',
            required: false,
            maxSelect: 1,
            collectionId: members.id,
            cascadeDelete: false,
            presentable: true,
          },
          { type: 'text', name: 'note', max: 8000 },
          {
            type: 'number',
            name: 'sort_order',
            onlyInt: true,
            min: 0,
            max: 100000,
          },
        ],
      })
      app.save(keyResultsCol)
    }

    keyResultsCol = app.findCollectionByNameOrId('key_results')
    const taskNames = tasks.fields.fieldNames()
    if (!taskNames.includes('key_result')) {
      tasks.fields.add(
        new RelationField({
          name: 'key_result',
          required: false,
          maxSelect: 1,
          collectionId: keyResultsCol.id,
          cascadeDelete: false,
          presentable: true,
        }),
      )
      app.save(tasks)
    }

    const memberNames = members.fields.fieldNames()
    if (!memberNames.includes('status')) {
      members.fields.add(
        new SelectField({
          name: 'status',
          required: false,
          maxSelect: 1,
          values: [
            { value: 'active', text: '在岗' },
            { value: 'inactive', text: '停用' },
          ],
        }),
      )
      app.save(members)
    }

    try {
      const rows = app.findRecordsByFilter(members.id, '', '', 0, 0)
      for (const r of rows) {
        if (!r) continue
        const st = r.get('status')
        if (st == null || st === '') {
          r.set('status', 'active')
          app.save(r)
        }
      }
    } catch (e) {
      console.error('1778099000 goalops: backfill members.status', e)
    }
  },
  (app) => {
    void app
  },
)
