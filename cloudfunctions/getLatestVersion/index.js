const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const res = await db.collection('wechat_pc_version')
      .orderBy('releaseDate', 'desc')
      .limit(1)
      .get()
    return {
      data: res.data
    }
  } catch (err) {
    return {
      data: [],
      error: err.message
    }
  }
}
