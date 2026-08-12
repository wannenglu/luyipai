// cloudfunctions/getVersionDetail/index.js
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event) => {
  const { _id } = event
  const res = await db.collection("wechat_pc_version")
    .where({
      _id: db.command.eq(_id)
    })
    .get()
  return {
    data: res.data[0] || null
  }
}
