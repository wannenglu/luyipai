App({
  globalData: {
    latestPwd: "",
    adminClickCount: 0,
    adminClickTimer: null
  },
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: "提示", content: "请使用2.2.3以上基础库" })
    } else {
      wx.cloud.init({
        env: "cloudbase-d7gak6ke429fc2da2",
        traceUser: true
      })
    }
  }
})