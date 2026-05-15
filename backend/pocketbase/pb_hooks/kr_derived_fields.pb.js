/// <reference path="../pb_data/types.d.ts" />

/**
 * GET /api/goalops/key_results/{id}/derived
 *
 * Returns derived fields for a key result based on its latest check-in:
 * - latest_value         : metric → latest current_value；checkbox/milestone → 派生
 * - latest_confidence    : 最近一条 check-in 的 confidence
 * - latest_checkin_date  : 最近一条 check-in 的 checkin_date
 * - score                : 仅 metric。clamp((latest - start) / (target - start), 0, 1)
 */
routerAdd('GET', '/api/goalops/key_results/{id}/derived', (e) => {
  const numOrNull = function (v) {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return isFinite(n) ? n : null
  }

  try {
    const id = e.request.pathValue('id')
    if (!id) {
      return e.json(400, { error: 'missing id' })
    }

    let kr
    try {
      kr = e.app.findRecordById('key_results', id)
    } catch (_) {
      return e.json(404, { error: 'key_result not found' })
    }

    const result = {
      key_result: id,
      kr_type: kr.get('kr_type') || 'checkbox',
      start_value: numOrNull(kr.get('start_value')),
      target_value: numOrNull(kr.get('target_value')),
      unit: kr.get('unit') || '',
      direction: kr.get('direction') || null,
      latest_value: null,
      latest_confidence: null,
      latest_checkin_date: null,
      score: null,
    }

    let latest = null
    try {
      const rows = e.app.findRecordsByFilter(
        'kr_checkins',
        'key_result = "' + id + '"',
        '-checkin_date',
        1,
        0,
      )
      if (rows && rows.length > 0) latest = rows[0]
    } catch (err) {
      console.log('kr_derived_fields find checkins error: ' + err)
      return e.json(200, result)
    }

    if (!latest) {
      return e.json(200, result)
    }

    result.latest_confidence = numOrNull(latest.get('confidence'))
    const d = latest.get('checkin_date')
    result.latest_checkin_date = d ? String(d).slice(0, 10) : null

    if (result.kr_type === 'metric') {
      const v = numOrNull(latest.get('current_value'))
      result.latest_value = v
      const start = result.start_value
      const target = result.target_value
      if (
        v !== null &&
        start !== null &&
        target !== null &&
        target !== start
      ) {
        let raw
        if (result.direction === 'decrease') {
          raw = (start - v) / (start - target)
        } else {
          raw = (v - start) / (target - start)
        }
        if (isFinite(raw)) {
          result.score = Math.max(0, Math.min(1, raw))
        }
      }
    } else if (result.kr_type === 'milestone') {
      result.latest_value = numOrNull(latest.get('progress_percent'))
    } else {
      const ic = latest.get('is_completed')
      result.latest_value = ic === true ? 100 : ic === false ? 0 : null
    }

    return e.json(200, result)
  } catch (err) {
    console.log('kr_derived_fields error: ' + err)
    return e.json(500, { error: String(err && err.message ? err.message : err) })
  }
})
