Component({
  properties:{
    visible:{
      type:Boolean,
      value:false
    }
  },
  data:{
    pwd:"",
    isPwdHide:true
  },
  methods:{
    stopBubble(){},
    handleMaskClick(){},
    onInput(e){
      this.setData({
        pwd: e.detail.value
      })
    },
    togglePwdShow(){
      console.log('切换显示状态'); // 调试用，能打印就代表点击生效
      this.setData({
        isPwdHide: !this.data.isPwdHide
      })
    },
    previewQr(){
      wx.previewImage({
        urls:["/images/ewm.jpg"]
      })
    },
    submitPwd(){
      const input = this.data.pwd.trim()
      this.triggerEvent("inputconfirm", {pwd: input})
      this.setData({pwd:""})
    }
  }
})
