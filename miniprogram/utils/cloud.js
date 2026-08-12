// 本项目不再前端直接操作数据库，此文件保留兼容，页面不再require使用
const db = wx.cloud.database()
const versionColl = db.collection("wechat_pc_version")
module.exports = {
  versionColl
}
