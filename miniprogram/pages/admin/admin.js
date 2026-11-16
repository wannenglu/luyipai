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
    // 列表页跳转编辑：先用列表缓存的数据立即回填，再拉取最新详情
    if(options._id){
      const cached = wx.getStorageSync("editing_version")
      if(cached && cached._id === options._id){
        this.fillForm(cached)
        wx.removeStorageSync("editing_version")
      }
      this.loadEditData(options._id)
      return
    }
    const today = this.getTodayDate()
    this.setData({
      "form.releaseDate": today,
      "form.remark": this.data.remarkOptions[0]
    })
  },

  getTodayDate(){
    const date = new Date()
    const y = date.getFullYear()
    const m = String(date.getMonth()+1).padStart(2,'0')
    const d = String(date.getDate()).padStart(2,'0')
    return `${y}-${m}-${d}`
  },

  // 统一把版本数据回填到表单
  fillForm(data){
    if(!data) return
    this.setData({
      form:{
        _id: data._id || "",
        version: data.version || "",
        releaseDate: data.releaseDate || "",
        password: data.password || "",
        aliyunLink: data.aliyunLink || "",
        updateDesc: data.updateDesc || "",
        remark: data.remark || this.data.remarkOptions[0]
      },
      remarkIndex: data.remark === "白名单" ? 1 : 0
    })
  },

  // 通过云函数获取单条编辑数据
  async loadEditData(_id){
    wx.showLoading({title:"加载中"})
    try{
      const res = await wx.cloud.callFunction({
        name:"getVersionDetail",
        data:{_id}
      })
      const data = res.result && res.result.data
      if(!data) throw new Error("未找到该版本")
      this.fillForm(data)
    }catch(err){
      console.error("读取版本详情失败", err)
      wx.hideLoading()
      // 缓存已回填时不打扰用户，只有完全没数据才提示
      if(!this.data.form.version){
        wx.showToast({title:"版本详情读取失败，请重试",icon:"none"})
      }
      return
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

  // 快速追加固定更新日志
  addQuickText(){
    const quickText = "- 修复一些已知问题。"
    const current = (this.data.form.updateDesc || "").trim()
    this.setData({
      "form.updateDesc": current ? `${current}\n${quickText}` : quickText
    })
  },

  // 随机生成 6 位访问密码（0-9、a-z、A-Z 任意组合）
  genPassword(){
    const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let pwd = ""
    for(let i = 0; i < 6; i++){
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    this.setData({"form.password": pwd})
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
