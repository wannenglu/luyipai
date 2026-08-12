const LIMIT = 10;
Page({
  data:{
    list:[],
    keyword:"",
    page:1
  },
  onLoad(){
    this.loadData()
  },
  onKeywordInput(e){
    this.setData({keyword:e.detail.value})
  },
  searchData(){
    this.setData({page:1})
    this.loadData()
  },
  async loadData(){
    wx.showLoading({title:"加载中"})
    try{
      const { keyword, page } = this.data
      const res = await wx.cloud.callFunction({
        name:"getVersionList",
        data:{
          keyword,
          page,
          pageSize: LIMIT
        }
      })
      console.log('云函数返回', res.result)
      // 核心修改：后端返回 data 字段，不是 list
      const list = res.result.data || []
      this.setData({list})
    }catch(err){
      console.error('加载失败', err)
      wx.showToast({title:"加载失败",icon:"none"})
    }
    wx.hideLoading()
  },
  // 上一页
  prevPage(){
    if(this.data.page <= 1) return
    this.setData({page: this.data.page - 1}, ()=>{
      this.loadData()
    })
  },
  // 下一页（简易判断：当前页返回不足10条则无下一页）
  nextPage(){
    const { list, page } = this.data
    if(list.length < LIMIT) {
      wx.showToast({title:"没有更多数据",icon:"none"})
      return
    }
    this.setData({page: page + 1}, ()=>{
      this.loadData()
    })
  },
  editItem(e){
    const _id = e.currentTarget.dataset.id
    console.log('点击编辑，id：', _id)
    wx.navigateTo({
      url:`/pages/admin/admin?_id=${_id}`
    })
  },
  deleteItem(e){
    const _id = e.currentTarget.dataset.id
    wx.showModal({
      title:"确认删除",
      content:"删除后无法恢复",
      success:async res=>{
        if(res.confirm){
          wx.showLoading()
          await wx.cloud.callFunction({
            name:"saveVersion",
            data:{action:"delete",_id}
          })
          wx.hideLoading()
          wx.showToast({title:"已删除"})
          this.loadData()
        }
      }
    })
  }
})
