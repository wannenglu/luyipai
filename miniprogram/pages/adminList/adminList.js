const { debounce } = require("../../utils/tool")
const LIMIT = 10;
Page({
  data:{
    list:[],
    keyword:"",
    page:1
  },
  reqId: 0,
  onLoad(){
    this.loadData()
  },
  // 输入即检索，防抖 300ms
  onKeywordInput: debounce(function(e){
    this.setData({keyword:e.detail.value, page:1}, ()=>{
      this.loadData()
    })
  }, 300),
  // 刷新，回到第一页
  refreshList(){
    this.setData({page:1}, ()=>{
      this.loadData()
    })
  },
  // 清空搜索关键词并恢复完整列表
  clearKeyword(){
    this.setData({keyword:"", page:1}, ()=>{
      this.loadData()
    })
  },
  async loadData(){
    const reqId = ++this.reqId
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
      // 只采用最后一次请求的结果，避免快速输入时旧结果覆盖新结果
      if(reqId !== this.reqId) return
      const list = res.result.data || []
      this.setData({list})
    }catch(err){
      if(reqId === this.reqId){
        console.error('加载失败', err)
        wx.hideLoading()
        wx.showToast({title:"加载失败",icon:"none"})
      }
      return
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
    // 列表已有完整数据，先缓存给编辑页立即回填，避免详情接口失败时表单为空
    const item = this.data.list.find(v => v._id === _id)
    if(item){
      wx.setStorageSync("editing_version", item)
    }
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
