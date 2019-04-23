// 使用 require 动态引用，而不是 import 静态引用

function pageEnv(win) {
  if (win === top) {
    // 开放一个接口，可供 iframe 调用
    win.__init__ = function(win) {
      page.init(win)
      console.log('[jsproxy] child page inited.', win.location.href)
    }

    // 用于记录 postMessage 发起者的 win
    let lastSrcWin
    win.__set_srcWin = function(obj) {
      lastSrcWin = obj || win
      return []
    }
    win.__get_srcWin = function() {
      const ret = lastSrcWin
      lastSrcWin = null
      return ret
    }

    const page = require('./page.js')
    page.init(win)
    console.log('[jsproxy] top page inited')
  } else {
    // 子页面直接调用 top 提供的接口，无需重复初始化
    top.__init__(win)

    win.__set_srcWin = function() {
      return top.__set_srcWin(win)
    }
  }
}

function swEnv() {
  require('./sw.js')
}

function workerEnv(global) {
  require('./client.js').init(global, location.origin)
  global.__set_srcWin = function() {
    return []
  }
}

function main(global) {
  if ('onclick' in global) {
    pageEnv(global)
  } else if ('onfetch' in global) {
    swEnv()
  } else {
    workerEnv(global)
  }
}

main(self)