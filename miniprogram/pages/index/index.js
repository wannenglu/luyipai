const { copyText, debounce } = require("../../utils/tool")
const app = getApp()
// 页面全局广告实例
// let videoAd = null
// // 替换成你自己流量主激励广告ID
// const AD_UNIT_ID = "adunit-xxxxxxxxxxxxxxxx"

Page({
  data: {
    showAccessPwdModal: true,
    passAuth: false,
    keyword: "",
    versionList: [],
    showQrcode: false,
    showAdminPwdModal: false,
    page: 1,
    pageSize: 10,
    noMore: false,
    isRequesting: false
  },
  onLoad() {
    this.loadLatestPassword()
    // 页面加载初始化广告
    // this.initVideoAd()
  },
  onReachBottom() {
    // console.log("【触底事件触发】", this.data.noMore, this.data.isRequesting)
    if (this.data.noMore || this.data.isRequesting) return
    this.loadVersionList(true)
  },
  // 初始化激励广告
  // initVideoAd() {
  //   if (!wx.createRewardedVideoAd) return
  //   videoAd = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_ID })
  //   // 广告加载失败自动重试
  //   videoAd.onError(() => {
  //     videoAd.load()
  //   })
  //   // 广告关闭回调
  // videoAd.onClose(res => {
  //   // res.isEnded = true 代表完整看完广告
  //   if (res && res.isEnded) {
  //     // 执行复制链接
  //     this.doCopyLink(this.tempLink)
  //   } else {
  //     wx.showToast({ title: '广告未看完，无法复制链接', icon: 'none' })
  //   }
  // }) 
  //   // 预加载广告
  //   video.load()
  // },
  // // 缓存待复制链接，唤起广告
  // showAdBeforeCopy(e) {
  //   const link = e.currentTarget.dataset.link
  //   if (!link) return
  //   this.tempLink = link
  //   // 展示广告
  //   videoAd.show().catch(() => {
  //     // 展示失败重新加载再弹出
  //     videoAd.load().then(() => videoAd.show())
  //   })
  // },
  // // 真正复制链接（看完广告后执行）
  // async doCopyLink(link) {
  //   const success = await copyText(link)
  //   if (success) wx.showToast({ title: '下载链接已复制' })
  //   else wx.showToast({ title: '复制失败', icon: 'none' })
  //   // 看完广告重新预加载下一次广告
  //   videoAd.load()
  // },

  async loadLatestPassword() {
    wx.showLoading({ title: "初始化中" })
    try {
      const res = await wx.cloud.callFunction({ name: "getLatestVersion" })
      const data = res.result.data || []
      if (data.length > 0) {
        app.globalData.latestPwd = data[0].password || ""
        const localSavePwd = wx.getStorageSync("access_pwd")
        if (localSavePwd && localSavePwd === app.globalData.latestPwd) {
          this.setData({ passAuth: true, showAccessPwdModal: false })
          this.loadVersionList(false)
        }
      }
    } catch (err) {
      wx.showToast({ title: '初始化加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  checkAccessPwd(e) {
    const inputPwd = e.detail.pwd
    const targetPwd = app.globalData.latestPwd
    // console.log(e.detail.pwd)
    // console.log(targetPwd)
    if (!targetPwd) {
      wx.showToast({ title: '配置未就绪，请稍后重试', icon: 'none' })
      return
    }
    if (inputPwd === targetPwd) {
      wx.setStorageSync("access_pwd", inputPwd)
      this.setData({ passAuth: true, showAccessPwdModal: false })
      this.loadVersionList(false)
    } else {
      wx.showToast({ title: '密码错误', icon: 'none' })
    }
  },

  async loadVersionList(isLoadMore = false) {
    if (this.data.isRequesting) return
    this.setData({ isRequesting: true })
    wx.showLoading({ title: isLoadMore ? "加载更多" : "加载中" })
    try {
      let { page, pageSize, keyword } = this.data
      if (isLoadMore) {
        page += 1
      }
      const res = await wx.cloud.callFunction({
        name: "getVersionList",
        data: { page, pageSize, keyword }
      })
      const rawList = res.result.data || []
      const list = rawList.map(item => ({
        ...item,
        expand: false,
        isExpandable: false
      }))

      if (!isLoadMore) {
        this.setData({
          versionList: list,
          page: 1,
          noMore: list.length < pageSize
        }, () => {
          setTimeout(() => this.calcTextOverflow(), 200)
        })
      } else {
        const newList = [...this.data.versionList, ...list]
        this.setData({
          versionList: newList,
          page: page,
          noMore: list.length < pageSize
        }, () => {
          setTimeout(() => this.calcTextOverflow(), 200)
        })
      }
    } catch (err) {
      wx.showToast({ title: '读取列表失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ isRequesting: false })
    }
  },

  calcTextOverflow() {
    setTimeout(() => {
      const query = wx.createSelectorQuery().in(this)
      query.selectAll('.log-text').boundingClientRect()
      query.exec(res => {
        const rectList = res[0] || []
        const list = [...this.data.versionList]
        const LIMIT_HEIGHT = 60
        rectList.forEach((rect, idx) => {
          if (!rect) return
          // console.log(`第${idx}条文字高度：`, rect.height)
          list[idx].isExpandable = rect.height > LIMIT_HEIGHT
        })
        this.setData({ versionList: list })
      })
    }, 250)
  },

  onSearchInput: debounce(function (e) {
    const keyword = e.detail.value.toLowerCase()
    this.setData({ keyword }, () => {
      this.loadVersionList(false)
    })
  }, 300),

  clearSearch() {
    this.setData({ keyword: "" }, () => {
      this.loadVersionList(false)
    })
  },

  toggleExpand(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.versionList.map(item => {
      if (item._id === id) item.expand = !item.expand
      return item
    })
    this.setData({ versionList: list })
  },

  // 原始直接复制逻辑（启用）
  async copyLink(e) {
    const link = e.currentTarget.dataset.link
    if (!link) return
    const success = await copyText(link)
    if (success) wx.showToast({ title: '链接已复制' })
    else wx.showToast({ title: '复制失败', icon: 'none' })
  },
  // 旧复制方法废弃，替换为广告唤起
  // copyLink(e) {
  //   this.showAdBeforeCopy(e)
  // },

  showQrcodeModal() {
    this.setData({ showQrcode: true })
  },
  closeQrcode() {
    this.setData({ showQrcode: false })
  },
  previewImg() {
    wx.previewImage({ urls: ["/images/ewm.jpg"] })
  },

  stopBubble() {
  },

  onTitleTap() {
    app.globalData.adminClickCount++
    clearTimeout(app.globalData.adminClickTimer)
    app.globalData.adminClickTimer = setTimeout(() => {
      app.globalData.adminClickCount = 0
    }, 2000)
    if (app.globalData.adminClickCount >= 5) {
      app.globalData.adminClickCount = 0
      this.setData({ showAdminPwdModal: true })
    }
  },

  async onAdminPwdConfirm(e) {
    const inputPwd = e.detail.pwd.trim()
    wx.showLoading()
    try {
      const res = await wx.cloud.callFunction({ name: "getAdminConfig" })
      const realPwd = res.result.publish_password
      if (inputPwd === realPwd) {
        wx.navigateTo({ url: "/pages/admin/admin" })
        this.setData({ showAdminPwdModal: false })
      } else {
        wx.showToast({ title: '管理员密码错误', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '配置读取失败', icon: 'none' })
    }
    wx.hideLoading()
  }
})
