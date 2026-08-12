// cloudfunctions/saveVersion/index.js
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event) => {
  const { action, data, _id } = event
  const coll = db.collection('wechat_pc_version')

  if (action === 'add') {
    // 新增：删除 _id，让数据库自动生成，杜绝冲突
    const insertData = {...data}
    delete insertData._id
    return await coll.add({ data: insertData })
  } else if (action === 'update') {
    // 更新：使用路径传入的 _id，不要依赖data内部的_id
    const updateData = {...data}
    delete updateData._id
    return await coll.doc(_id).update({ data: updateData })
  } else if (action === 'delete') {
    return await coll.doc(_id).remove()
  }
}
