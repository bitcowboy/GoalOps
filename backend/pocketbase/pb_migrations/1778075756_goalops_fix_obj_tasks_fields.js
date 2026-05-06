/// <reference path="../pb_data/types.d.ts" />

/**
 * 修复：部分环境下首条迁移里用字面量描述的 fields 未正确落库，导致 Admin 里只看到 id。
 * 若 `name` 等字段已存在则跳过（幂等）。
 */
migrate(
  (app) => {
    const members = app.findCollectionByNameOrId('members')
    const objectives = app.findCollectionByNameOrId('objectives')
    const tasks = app.findCollectionByNameOrId('tasks')

    const oNames = objectives.fields.fieldNames()
    if (!oNames.includes('name')) {
      objectives.fields.add(
        new TextField({
          name: 'name',
          required: true,
        }),
      )
    }
    if (!oNames.includes('definition')) {
      objectives.fields.add(new EditorField({ name: 'definition' }))
    }
    if (!oNames.includes('progress_percent')) {
      objectives.fields.add(
        new NumberField({
          name: 'progress_percent',
          min: 0,
          max: 100,
        }),
      )
    }
    if (!oNames.includes('status')) {
      objectives.fields.add(
        new SelectField({
          name: 'status',
          required: true,
          maxSelect: 1,
          values: [
            { value: 'not_started', text: '未开始' },
            { value: 'in_progress', text: '进行中' },
            { value: 'at_risk', text: '风险' },
            { value: 'done', text: '完成' },
            { value: 'cancelled', text: '取消' },
          ],
        }),
      )
    }
    if (!oNames.includes('priority')) {
      objectives.fields.add(
        new SelectField({
          name: 'priority',
          required: true,
          maxSelect: 1,
          values: [
            { value: 'P0', text: 'P0' },
            { value: 'P1', text: 'P1' },
            { value: 'P2', text: 'P2' },
            { value: 'P3', text: 'P3' },
          ],
        }),
      )
    }
    if (!oNames.includes('owner')) {
      objectives.fields.add(
        new RelationField({
          name: 'owner',
          required: true,
          maxSelect: 1,
          collectionId: members.id,
          cascadeDelete: false,
          presentable: true,
        }),
      )
    }
    if (!oNames.includes('start_date')) {
      objectives.fields.add(new DateField({ name: 'start_date' }))
    }
    if (!oNames.includes('due_date')) {
      objectives.fields.add(new DateField({ name: 'due_date' }))
    }
    app.save(objectives)

    const tNames = tasks.fields.fieldNames()
    if (!tNames.includes('title')) {
      tasks.fields.add(
        new TextField({
          name: 'title',
          required: true,
        }),
      )
    }
    if (!tNames.includes('objective')) {
      tasks.fields.add(
        new RelationField({
          name: 'objective',
          required: true,
          maxSelect: 1,
          collectionId: objectives.id,
          cascadeDelete: true,
        }),
      )
    }
    if (!tNames.includes('assignee')) {
      tasks.fields.add(
        new RelationField({
          name: 'assignee',
          maxSelect: 1,
          collectionId: members.id,
          cascadeDelete: false,
        }),
      )
    }
    if (!tNames.includes('status')) {
      tasks.fields.add(
        new SelectField({
          name: 'status',
          required: true,
          maxSelect: 1,
          values: [
            { value: 'pending', text: '未开始' },
            { value: 'in_progress', text: '进行中' },
            { value: 'deliver', text: '交付' },
            { value: 'review', text: '验收' },
            { value: 'done', text: '完结' },
          ],
        }),
      )
    }
    if (!tNames.includes('priority')) {
      tasks.fields.add(
        new SelectField({
          name: 'priority',
          required: true,
          maxSelect: 1,
          values: [
            { value: 'P0', text: 'P0' },
            { value: 'P1', text: 'P1' },
            { value: 'P2', text: 'P2' },
            { value: 'P3', text: 'P3' },
          ],
        }),
      )
    }
    if (!tNames.includes('predecessor_ids')) {
      tasks.fields.add(
        new JSONField({
          name: 'predecessor_ids',
          maxSize: 200000,
        }),
      )
    }
    if (!tNames.includes('estimate_hours')) {
      tasks.fields.add(
        new NumberField({
          name: 'estimate_hours',
          min: 0,
          max: 10000,
        }),
      )
    }
    app.save(tasks)
  },
  (app) => {
    /** 不自动删除字段，避免丢数据；如需回滚请在 Admin 手工调整 */
    void app
  },
)
