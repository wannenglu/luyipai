// 云函数 getVersionList/index.js
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event) => {
  const { page = 1, pageSize = 10, keyword = "" } = event
  let query = db.collection("wechat_pc_version")
  // 搜索版本号模糊匹配
  if (keyword) {
    query = query.where({
      version: db.RegExp({ regexp: keyword, options: 'i' })
    })
  }
  // 分页计算跳过条数
  const skipNum = (page - 1) * pageSize
  // 按发布日期倒序
  const res = await query
    .orderBy("releaseDate", "desc")
    .skip(skipNum)
    .limit(pageSize)
    .get()
  return { data: res.data }
}
