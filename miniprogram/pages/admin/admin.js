Page({
  data:{
    form:{
      _id:"",
      version:"",
      releaseDate:"",
      password:"",
      aliyunLink:"",
      updateDesc:"",
      remark:""
    },
    remarkOptions: ["无需白名单", "白名单"],
    remarkIndex: 0
  },
  onLoad(options){
    const today = this.getTodayDate()
    this.setData({
      "form.releaseDate": today,
      "form.remark": this.data.remarkOptions[0]
    })
    // 列表页跳转编辑
    if(options._id){
      this.loadEditData(options._id)
    }
  },

  getTodayDate(){
    const date = new Date()
    const y = date.getFullYear()
    const m = String(date.getMonth()+1).padStart(2,'0')
    const d = String(date.getDate()).padStart(2,'0')
    return `${y}-${m}-${d}`
  },

  // 通过云函数获取单条编辑数据
  async loadEditData(_id){
    wx.showLoading({title:"加载中"})
    try{
      const res = await wx.cloud.callFunction({
        name:"getVersionDetail",
        data:{_id}
      })
      const data = res.result.data
      let idx = data.remark === "白名单" ? 1 : 0
      this.setData({
        form: data,
        remarkIndex: idx
      })
    }catch(err){
      wx.showToast({title:"加载失败",icon:"none"})
    }
    wx.hideLoading()
  },

  goToListPage(){
    wx.navigateTo({url:"/pages/adminList/adminList"})
  },

  onInputChange(e){
    const key = e.currentTarget.dataset.key
    const val = e.detail.value
    this.setData({[`form.${key}`]:val})
  },

  onDateChange(e){
    this.setData({"form.releaseDate": e.detail.value})
  },

  onRemarkChange(e){
    const idx = e.detail.value
    const text = this.data.remarkOptions[idx]
    this.setData({remarkIndex: idx,"form.remark": text})
  },

  resetToAdd(){
    const today = this.getTodayDate()
    this.setData({
      form:{
        _id:"",version:"",releaseDate:today,
        password:"",aliyunLink:"",updateDesc:"",remark:this.data.remarkOptions[0]
      },
      remarkIndex:0
    })
    wx.pageScrollTo({scrollTop:0})
  },

  async saveItem(){
    const form = {...this.data.form}
    if(!form.password) form.password = "wxpc"
    if(!form.version || !form.releaseDate || !form.aliyunLink){
      wx.showToast({title:"版本、日期、链接不能为空",icon:"none"})
      return
    }
    wx.showLoading({title:"保存中"})
    try{
      await wx.cloud.callFunction({
        name:"saveVersion",
        data:{
          action: form._id ? "update" : "add",
          _id: form._id,
          data: form
        }
      })
      wx.showToast({title:"保存成功"})
      this.resetToAdd()
    }catch(err){
      wx.showToast({title:"保存失败",icon:"none"})
    }
    wx.hideLoading()
  }
})
