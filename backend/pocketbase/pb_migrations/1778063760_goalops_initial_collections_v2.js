/// <reference path="../pb_data/types.d.ts" />

/**
 * GoalOps MVP：创建与 COLLECTIONS.md 一致的集合。
 * 开发期放开 API 规则（空字符串表示访客可访问，见 PocketBase「API rules and filters」文档）。
 */
migrate(
  (app) => {
    const open = ''

    // --- members ---
    const members = new Collection({
      type: 'base',
      name: 'members',
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { type: 'text', name: 'name', required: true },
        { type: 'text', name: 'role' },
        { type: 'text', name: 'team' },
        {
          type: 'number',
          name: 'weekly_available_hours',
          onlyInt: true,
          min: 0,
          max: 200,
          presentable: true,
        },
      ],
    })
    app.save(members)

    const membersCol = app.findCollectionByNameOrId('members')

    // --- objectives ---
    const objectives = new Collection({
      type: 'base',
      name: 'objectives',
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { type: 'text', name: 'name', required: true },
        { type: 'editor', name: 'definition' },
        {
          type: 'number',
          name: 'progress_percent',
          min: 0,
          max: 100,
        },
        {
          type: 'select',
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
        },
        {
          type: 'select',
          name: 'priority',
          required: true,
          maxSelect: 1,
          values: [
            { value: 'P0', text: 'P0' },
            { value: 'P1', text: 'P1' },
            { value: 'P2', text: 'P2' },
            { value: 'P3', text: 'P3' },
          ],
        },
        {
          type: 'relation',
          name: 'owner',
          required: true,
          maxSelect: 1,
          collectionId: membersCol.id,
          cascadeDelete: false,
          presentable: true,
        },
        { type: 'date', name: 'start_date' },
        { type: 'date', name: 'due_date' },
      ],
    })
    app.save(objectives)

    const objectivesCol = app.findCollectionByNameOrId('objectives')

    // --- tasks ---
    const tasks = new Collection({
      type: 'base',
      name: 'tasks',
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { type: 'text', name: 'title', required: true },
        {
          type: 'relation',
          name: 'objective',
          required: true,
          maxSelect: 1,
          collectionId: objectivesCol.id,
          cascadeDelete: true,
        },
        {
          type: 'relation',
          name: 'assignee',
          maxSelect: 1,
          collectionId: membersCol.id,
          cascadeDelete: false,
        },
        {
          type: 'select',
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
        },
        {
          type: 'select',
          name: 'priority',
          required: true,
          maxSelect: 1,
          values: [
            { value: 'P0', text: 'P0' },
            { value: 'P1', text: 'P1' },
            { value: 'P2', text: 'P2' },
            { value: 'P3', text: 'P3' },
          ],
        },
        {
          type: 'json',
          name: 'predecessor_ids',
          maxSize: 200000,
        },
        { type: 'number', name: 'estimate_hours', min: 0, max: 10000 },
      ],
    })
    app.save(tasks)

    // --- deliverables ---
    const deliverables = new Collection({
      type: 'base',
      name: 'deliverables',
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { type: 'text', name: 'title', required: true },
        {
          type: 'relation',
          name: 'objective',
          required: true,
          maxSelect: 1,
          collectionId: objectivesCol.id,
          cascadeDelete: true,
        },
        { type: 'text', name: 'status' },
      ],
    })
    app.save(deliverables)

    // --- core_documents ---
    const coreDocuments = new Collection({
      type: 'base',
      name: 'core_documents',
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { type: 'text', name: 'title', required: true },
        { type: 'url', name: 'url' },
        {
          type: 'relation',
          name: 'objective',
          required: true,
          maxSelect: 1,
          collectionId: objectivesCol.id,
          cascadeDelete: true,
        },
      ],
    })
    app.save(coreDocuments)

    // --- blockers ---
    const blockers = new Collection({
      type: 'base',
      name: 'blockers',
      listRule: open,
      viewRule: open,
      createRule: open,
      updateRule: open,
      deleteRule: open,
      fields: [
        { type: 'text', name: 'description', required: true },
        {
          type: 'select',
          name: 'severity',
          required: true,
          maxSelect: 1,
          values: [
            { value: 'low', text: '低' },
            { value: 'medium', text: '中' },
            { value: 'high', text: '高' },
          ],
        },
        {
          type: 'relation',
          name: 'objective',
          required: true,
          maxSelect: 1,
          collectionId: objectivesCol.id,
          cascadeDelete: true,
        },
      ],
    })
    app.save(blockers)

  },
  (app) => {
    const names = [
      'blockers',
      'core_documents',
      'deliverables',
      'tasks',
      'objectives',
      'members',
    ]
    for (const name of names) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {
        /** already removed */
      }
    }
  },
)
