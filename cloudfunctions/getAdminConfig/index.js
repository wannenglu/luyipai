const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const res = await db.collection('admin_config').get()
    if(res.data.length > 0){
      return {
        publish_password: res.data[0].publish_password
      }
    }else{
      return {
        publish_password: ""
      }
    }
  } catch (err) {
    return {
      publish_password: "",
      error: err.message
    }
  }
}
