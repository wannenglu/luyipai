Component({
  properties:{
    visible:{
      type:Boolean,
      value:false
    }
  },
  data:{
    pwd:""
  },
  methods:{
    stop(){},
    maskClose(){},
    onInput(e){
      this.setData({
        pwd: e.detail.value
      })
    },
    confirm(){
      const val = this.data.pwd.trim()
      this.triggerEvent("adminconfirm", {pwd:val})
      this.setData({pwd:""})
    }
  }
})
