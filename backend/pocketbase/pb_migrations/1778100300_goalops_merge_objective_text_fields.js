/// <reference path="../pb_data/types.d.ts" />

/**
 * 合并目标的「一句话定义」「目标摘要（长文）」「目标描述」三个字段：
 * 统一并入 `objectives.definition`，并删除 `one_sentence_definition`、`background`。
 *
 * 合并顺序：one_sentence_definition → definition（HTML 去标签）→ background，
 * 以空行（`\n\n`）拼接；每段先 trim，空段跳过。
 *
 * 幂等：若两个旧字段已不存在，仅按当前 `definition` 现状回写（实际无变化）。
 */
migrate(
  (app) => {
    const objectives = app.findCollectionByNameOrId('objectives')
    const fieldNames = objectives.fields.fieldNames()
    const hasOne = fieldNames.includes('one_sentence_definition')
    const hasBg = fieldNames.includes('background')

    /**
     * 简易 HTML → 纯文本：替换 <br>、</p> 为换行，去掉其他标签，再解 HTML 实体。
     * @param {unknown} raw
     */
    function htmlToPlain(raw) {
      if (typeof raw !== 'string' || !raw) return ''
      let s = raw
      s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n')
      s = s.replace(/<\s*\/\s*p\s*>/gi, '\n')
      s = s.replace(/<[^>]*>/g, '')
      s = s
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
      s = s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
      return s.trim()
    }

    const rows = app.findRecordsByFilter(objectives.id, '', '', 0, 0)
    for (const r of rows) {
      const oneLine = hasOne ? htmlToPlain(r.get('one_sentence_definition')) : ''
      const defPlain = htmlToPlain(r.get('definition'))
      const bg = hasBg ? htmlToPlain(r.get('background')) : ''
      const merged = [oneLine, defPlain, bg]
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter((s) => s.length > 0)
        .join('\n\n')
      r.set('definition', merged)
      app.saveNoValidate(r)
    }

    if (hasOne) {
      objectives.fields.removeByName('one_sentence_definition')
    }
    if (hasBg) {
      objectives.fields.removeByName('background')
    }
    app.save(objectives)
  },
  (app) => {
    /** 不自动恢复字段，避免再次拆分文本时丢数据；如需回滚请在 Admin 手工添加字段。 */
    void app
  },
)
