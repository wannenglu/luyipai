// 复制文本
async function copyText(text) {
  return new Promise(resolve => {
    wx.setClipboardData({
      data: text,
      success: () => resolve(true),
      fail: () => resolve(false)
    })
  })
}

// 防抖
function debounce(fn, delay = 300) {
  let timer = null
  return function (e) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      fn.call(this, e)
    }, delay)
  }
}

module.exports = {
  copyText,
  debounce
}
