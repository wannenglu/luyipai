// 云函数 versionQuota
// 按 openid + 日期记录每日免费次数和当天已解锁的版本，换设备/清缓存不会重置
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()
const _ = db.command

const COLLECTION = 'version_quota'
const FREE_TIMES_PER_DAY = 3

// 按北京时间取日期，避免服务器 UTC 时间导致跨天不准
function getToday() {
  const d = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function calcFreeLeft(quota) {
  return Math.max(0, FREE_TIMES_PER_DAY - (quota.freeUsed || 0))
}

// 每个用户只保留一条记录（_id = openid），跨天时重置，不会无限累加
async function getOrCreate(openid, date) {
  const coll = db.collection(COLLECTION)
  let data = null
  try {
    const res = await coll.doc(openid).get()
    data = res.data
  } catch (err) {
    data = null
  }
  // 当天记录直接复用
  if (data && data.date === date) return data
  // 跨天或首次：重置为当天初始状态
  const fresh = { openid, date, freeUsed: 0, unlocked: [] }
  if (data) {
    await coll.doc(openid).update({
      data: { ...fresh, updateTime: db.serverDate() }
    })
  } else {
    await coll.doc(openid).set({
      data: { ...fresh, updateTime: db.serverDate() }
    })
  }
  return fresh
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action = 'query', id = '', allowFree = true } = event || {}
  const date = getToday()
  const docId = OPENID
  const quota = await getOrCreate(OPENID, date)
  const unlockedList = quota.unlocked || []

  // 查询当天状态，用于进入小程序时同步
  if (action === 'query') {
    return { ok: true, unlocked: unlockedList, freeLeft: calcFreeLeft(quota) }
  }

  // 该版本当天已获取过，直接放行，不扣次数
  if (id && unlockedList.indexOf(id) !== -1) {
    return { ok: true, freeLeft: calcFreeLeft(quota) }
  }

  // 免费获取：次数未用完则扣一次
  if (action === 'claim') {
    if (allowFree && calcFreeLeft(quota) > 0) {
      await db.collection(COLLECTION).doc(docId).update({
        data: {
          freeUsed: _.inc(1),
          unlocked: _.addToSet(id),
          updateTime: db.serverDate()
        }
      })
      return { ok: true, freeLeft: calcFreeLeft(quota) - 1 }
    }
    return { ok: false, needAd: true, freeLeft: calcFreeLeft(quota) }
  }

  // 看完广告后记录当天已解锁
  if (action === 'ad') {
    await db.collection(COLLECTION).doc(docId).update({
      data: {
        unlocked: _.addToSet(id),
        updateTime: db.serverDate()
      }
    })
    return { ok: true, freeLeft: calcFreeLeft(quota) }
  }

  return { ok: false, freeLeft: calcFreeLeft(quota) }
}
