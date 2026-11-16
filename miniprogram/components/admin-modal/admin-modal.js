Component({
  properties:{
    visible:{
      type:Boolean,
      value:false
    }
  },
  data:{
    pwd:"",
    pwdHide:true
  },
  methods:{
    stop(){},
    maskClose(){},
    onInput(e){
      this.setData({
        pwd: e.detail.value
      })
    },
    // 切换密码显示/隐藏
    togglePwd(){
      this.setData({pwdHide: !this.data.pwdHide})
    },
    confirm(){
      const val = this.data.pwd.trim()
      this.triggerEvent("adminconfirm", {pwd:val})
      this.setData({pwd:""})
    }
  }
})
