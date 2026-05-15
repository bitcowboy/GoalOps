/// <reference path="../pb_data/types.d.ts" />

/**
 * KR 迭代 v1.0：
 * 1) 新建 kr_checkins collection（KR 周期性快照）
 * 2) 扩展 key_results 字段：kr_type / start_value / target_value / unit / direction / contributors
 * 3) 现有 KR 数据回填 kr_type = "checkbox"
 *
 * 幂等：collection / field 已存在则跳过。
 * 中文铁律：本迁移不在字符串字面量里写业务中文（避免 Windows + goja 的 GBK 乱码）。
 */
migrate(
  (app) => {
    const open = ''

    const keyResults = app.findCollectionByNameOrId('key_results')
    const members = app.findCollectionByNameOrId('members')

    // --- 1) key_results 字段扩展 -------------------------------------------
    const krNames = keyResults.fields.fieldNames()

    if (!krNames.includes('kr_type')) {
      keyResults.fields.add(
        new SelectField({
          name: 'kr_type',
          required: false, // 写入时由 hook 强制；表层 required 给到 false 以兼容旧记录
          maxSelect: 1,
          values: ['metric', 'checkbox', 'milestone'],
        }),
      )
    }
    if (!krNames.includes('start_value')) {
      keyResults.fields.add(new NumberField({ name: 'start_value' }))
    }
    if (!krNames.includes('target_value')) {
      keyResults.fields.add(new NumberField({ name: 'target_value' }))
    }
    if (!krNames.includes('unit')) {
      keyResults.fields.add(new TextField({ name: 'unit', max: 32 }))
    }
    if (!krNames.includes('direction')) {
      keyResults.fields.add(
        new SelectField({
          name: 'direction',
          required: false,
          maxSelect: 1,
          values: ['increase', 'decrease'],
        }),
      )
    }
    if (!krNames.includes('contributors')) {
      keyResults.fields.add(
        new RelationField({
          name: 'contributors',
          required: false,
          maxSelect: 999, // PB v0.23 不把 0 当成 unlimited；用一个大数表示多选
          collectionId: members.id,
          cascadeDelete: false,
          presentable: false,
        }),
      )
    }
    app.save(keyResults)

    // 回填现有 KR 的 kr_type
    try {
      const rows = app.findRecordsByFilter(keyResults.id, '', '', 0, 0)
      for (const r of rows) {
        if (!r) continue
        const t = r.get('kr_type')
        if (t == null || t === '') {
          r.set('kr_type', 'checkbox')
          app.save(r)
        }
      }
    } catch (e) {
      console.error('1778835800 goalops: backfill key_results.kr_type', e)
    }

    // --- 2) kr_checkins collection ----------------------------------------
    let checkins
    try {
      checkins = app.findCollectionByNameOrId('kr_checkins')
    } catch (_) {
      checkins = null
    }

    if (!checkins) {
      const krCol = app.findCollectionByNameOrId('key_results')
      checkins = new Collection({
        type: 'base',
        name: 'kr_checkins',
        listRule: open,
        viewRule: open,
        createRule: open,
        updateRule: open,
        deleteRule: open,
        fields: [
          {
            type: 'relation',
            name: 'key_result',
            required: true,
            maxSelect: 1,
            collectionId: krCol.id,
            cascadeDelete: true,
            presentable: true,
          },
          { type: 'date', name: 'checkin_date', required: true },
          {
            type: 'select',
            name: 'checkin_type',
            required: true,
            maxSelect: 1,
            values: ['weekly', 'milestone', 'adhoc'],
          },
          { type: 'number', name: 'current_value' },
          { type: 'number', name: 'progress_percent', min: 0, max: 100 },
          { type: 'bool', name: 'is_completed' },
          {
            type: 'number',
            name: 'confidence',
            required: true,
            onlyInt: true,
            min: 1,
            max: 10,
          },
          {
            type: 'select',
            name: 'status_signal',
            required: true,
            maxSelect: 1,
            values: ['on_track', 'at_risk', 'off_track'],
          },
          { type: 'text', name: 'progress_note', required: true, max: 10000 },
          { type: 'text', name: 'blockers_note', max: 10000 },
          { type: 'text', name: 'next_focus', max: 10000 },
          {
            type: 'relation',
            name: 'author',
            required: true,
            maxSelect: 1,
            collectionId: members.id,
            cascadeDelete: false,
            presentable: true,
          },
          { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
          { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX `idx_checkin_kr_date` ON `kr_checkins` (`key_result`, `checkin_date` DESC)',
          'CREATE INDEX `idx_checkin_kr` ON `kr_checkins` (`key_result`)',
        ],
      })
      app.save(checkins)
    }
  },
  (app) => {
    // down: 删 kr_checkins，移除 key_results 新增字段
    try {
      const checkins = app.findCollectionByNameOrId('kr_checkins')
      app.delete(checkins)
    } catch (_) {
      /* 不存在则跳过 */
    }

    try {
      const kr = app.findCollectionByNameOrId('key_results')
      const drop = ['kr_type', 'start_value', 'target_value', 'unit', 'direction', 'contributors']
      const names = kr.fields.fieldNames()
      let mutated = false
      for (const f of drop) {
        if (names.includes(f)) {
          kr.fields.removeByName(f)
          mutated = true
        }
      }
      if (mutated) app.save(kr)
    } catch (e) {
      console.error('1778835800 goalops down: remove key_results fields', e)
    }
  },
)
