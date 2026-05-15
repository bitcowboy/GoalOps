/// <reference path="../pb_data/types.d.ts" />

/**
 * kr_checkins 写入前校验：
 * - checkin_date 不能晚于今天
 * - confidence 1..10 整数
 * - 度量字段三选一一致性：依据关联 KR 的 kr_type
 *   - metric    → 必须显式传 current_value（仅 create）
 *   - checkbox  → 必须显式传 is_completed（仅 create）
 *   - milestone → 必须显式传 progress_percent（仅 create）
 * - 跨类型混填禁止（create 与 update 都校验）
 * - 未传 status_signal 时按 confidence 推断
 *
 * "显式传"通过 e.requestInfo().body 检测，避开 number/bool 字段服务端默认 0/false
 * 与人工填 0/false 不可区分的问题。
 *
 * 注意：goja 不会把同文件其它顶层函数透出到 routerAdd / onXxx 回调闭包里。也不要用
 * 「工厂函数返回 arrow」这种二级函数语法 — 之前实测在 onRecordUpdateRequest 回调里
 * 会触发 goja 静默 500。所以把 create / update 写成两份独立的内联回调。
 */

const checkinCreateHandler = (e) => {
  const record = e.record
  if (!record) {
    e.next()
    return
  }

  let body = {}
  try {
    const info = e.requestInfo()
    if (info && info.body) body = info.body
  } catch (_) {
    body = {}
  }
  const sentKey = function (k) {
    return Object.prototype.hasOwnProperty.call(body, k)
  }

  const rawDate = record.get('checkin_date')
  if (!rawDate) throw new BadRequestError('checkin_date is required')
  const dateStr = String(rawDate).slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) throw new BadRequestError('checkin_date cannot be later than today')

  const conf = record.get('confidence')
  if (conf === null || conf === undefined || conf === '') {
    throw new BadRequestError('confidence is required')
  }
  const confNum = Number(conf)
  if (!isFinite(confNum) || confNum < 1 || confNum > 10) {
    throw new BadRequestError('confidence must be an integer in [1, 10]')
  }

  const krId = record.get('key_result')
  if (!krId) throw new BadRequestError('key_result is required')
  let kr
  try {
    kr = e.app.findRecordById('key_results', krId)
  } catch (_) {
    throw new BadRequestError('related key_result not found')
  }
  const krType = kr.get('kr_type') || 'checkbox'

  const sentCurrent = sentKey('current_value')
  const sentPercent = sentKey('progress_percent')
  const sentCompleted = sentKey('is_completed')

  if (krType === 'metric') {
    if (!sentCurrent) throw new BadRequestError('metric KR requires current_value on its check-in')
    if (sentPercent) throw new BadRequestError('metric KR check-in must not set progress_percent')
    if (sentCompleted) throw new BadRequestError('metric KR check-in must not set is_completed')
  } else if (krType === 'checkbox') {
    if (!sentCompleted) throw new BadRequestError('checkbox KR requires is_completed on its check-in')
    if (sentCurrent) throw new BadRequestError('checkbox KR check-in must not set current_value')
    if (sentPercent) throw new BadRequestError('checkbox KR check-in must not set progress_percent')
  } else if (krType === 'milestone') {
    if (!sentPercent) throw new BadRequestError('milestone KR requires progress_percent on its check-in')
    if (sentCurrent) throw new BadRequestError('milestone KR check-in must not set current_value')
  } else {
    throw new BadRequestError('unknown kr_type on related key_result: ' + krType)
  }

  const status = record.get('status_signal')
  if (!status) {
    let derived
    if (confNum >= 7) derived = 'on_track'
    else if (confNum >= 4) derived = 'at_risk'
    else derived = 'off_track'
    record.set('status_signal', derived)
  }

  e.next()
}

const checkinUpdateHandler = (e) => {
  const record = e.record
  if (!record) {
    e.next()
    return
  }

  let body = {}
  try {
    const info = e.requestInfo()
    if (info && info.body) body = info.body
  } catch (_) {
    body = {}
  }
  const sentKey = function (k) {
    return Object.prototype.hasOwnProperty.call(body, k)
  }

  // 日期：若本次 PATCH 改了 checkin_date，校验上限
  if (sentKey('checkin_date')) {
    const rawDate = record.get('checkin_date')
    if (!rawDate) throw new BadRequestError('checkin_date cannot be empty')
    const dateStr = String(rawDate).slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    if (dateStr > today) throw new BadRequestError('checkin_date cannot be later than today')
  }

  // 信心：若本次 PATCH 改了 confidence，校验范围
  if (sentKey('confidence')) {
    const conf = record.get('confidence')
    const confNum = Number(conf)
    if (!isFinite(confNum) || confNum < 1 || confNum > 10) {
      throw new BadRequestError('confidence must be an integer in [1, 10]')
    }
  }

  // 跨类型混填仍然禁止
  const krId = record.get('key_result')
  if (krId) {
    let kr = null
    try {
      kr = e.app.findRecordById('key_results', krId)
    } catch (_) {
      kr = null
    }
    if (kr) {
      const krType = kr.get('kr_type') || 'checkbox'
      const sentCurrent = sentKey('current_value')
      const sentPercent = sentKey('progress_percent')
      const sentCompleted = sentKey('is_completed')
      if (krType === 'metric') {
        if (sentPercent) throw new BadRequestError('metric KR check-in must not set progress_percent')
        if (sentCompleted) throw new BadRequestError('metric KR check-in must not set is_completed')
      } else if (krType === 'checkbox') {
        if (sentCurrent) throw new BadRequestError('checkbox KR check-in must not set current_value')
        if (sentPercent) throw new BadRequestError('checkbox KR check-in must not set progress_percent')
      } else if (krType === 'milestone') {
        if (sentCurrent) throw new BadRequestError('milestone KR check-in must not set current_value')
      }
    }
  }

  // status_signal 默认派生（若本次清空了它）
  if (sentKey('confidence')) {
    const status = record.get('status_signal')
    if (!status) {
      const confNum = Number(record.get('confidence'))
      let derived
      if (confNum >= 7) derived = 'on_track'
      else if (confNum >= 4) derived = 'at_risk'
      else derived = 'off_track'
      record.set('status_signal', derived)
    }
  }

  e.next()
}

onRecordCreateRequest(checkinCreateHandler, 'kr_checkins')
onRecordUpdateRequest(checkinUpdateHandler, 'kr_checkins')
