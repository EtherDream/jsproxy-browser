import * as env from './env.js'
import * as urlx from './urlx.js'
import * as util from './util.js'
import * as cookie from './cookie.js'
import * as network from './network.js'
import * as MSG from './msg.js'
import * as jsfilter from './jsfilter.js'
import * as inject from './inject.js'


const MAX_REDIR = 5


function sendMsg(target, cmd, val) {
  if (target) {
    target.postMessage([cmd, val])
  } else {
    console.warn('invalid target', cmd, val)
  }
}


// 也可以用 clientId 关联，但兼容性不高
let pageCounter = 0

/** @type {Map<number, [Function, number]} */
const pageWaitMap = new Map()

function genPageId() {
  return ++pageCounter
}

/**
 * @param {number} pageId 
 */
function pageWait(pageId) {
  return new Promise(cb => {
    // 设置最大等待时间
    // 有些页面不会执行 JS（例如查看源文件），导致永久等待
    const timer = setTimeout(_ => {
      pageWaitMap.delete(pageId)
      cb(false)
    }, 2000)

    pageWaitMap.set(pageId, [cb, timer])
  })
}

/**
 * @param {number} id 
 * @param {boolean} isDone 
 */
function pageNotify(id, isDone) {
  const arr = pageWaitMap.get(id)
  if (!arr) {
    console.warn('[jsproxy] unknown page id:', id)
    return
  }
  const [cb, timer] = arr
  if (isDone) {
    pageWaitMap.delete(id)
    cb(true)
  } else {
    // 页面已开始初始化，关闭定时器
    clearTimeout(timer)
  }
}


function makeErrRes(desc) {
  return new Response(desc, {
    status: 200
  })
}


/**
 * @param {Response} res 
 * @param {ResponseInit} resOpt 
 * @param {URL} urlObj 
 */
function processHtml(res, resOpt, urlObj) {
  const reader = res.body.getReader()
  let injected = false

  const stream = new ReadableStream({
    async pull(controller) {
      if (!injected) {
        injected = true

        // 注入页面顶部的代码
        const pageId = genPageId()
        const buf = inject.getHtmlCode(urlObj, pageId)
        controller.enqueue(buf)
console.log('new pageId:',pageId)
        // 留一些时间给页面做异步初始化
        const done = await pageWait(pageId)
        if (!done) {
          console.warn('[jsproxy] page wait timeout. id: %d url: %s',
            pageId, urlObj.href)
        }
      }
      const r = await reader.read()
      if (r.done) {
        controller.close()
      } else {
        controller.enqueue(r.value)
      }
    }
  })
  return new Response(stream, resOpt)
}


/**
 * @param {ArrayBuffer} buf 
 * @param {string} charset 
 */
function processJs(buf, charset) {
  const u8 = new Uint8Array(buf)
  const ret = jsfilter.parseBin(u8, charset) || u8
  return util.concatBufs([inject.getWorkerCode(), ret])
}


/**
 * @param {*} cmd 
 * @param {*} msg 
 * @param {string=} srcId
 */
async function sendMsgToPages(cmd, msg, srcId) {
  // 通知页面更新 Cookie
  const pages = await clients.matchAll({type: 'window'})

  for (const page of pages) {
    if (page.frameType !== 'top-level') {
      continue
    }
    if (srcId && page.id === srcId) {
      continue
    }
    sendMsg(page, cmd, msg)
  }
}


/** @type Map<string, string> */
const idUrlMap = new Map()

/**
 * @param {string} id 
 */
async function getUrlByClientId(id) {
  const client = await clients.get(id)
  if (!client) {
    return
  }
  const urlStr = urlx.decUrlStrAbs(client.url)
  idUrlMap.set(id, urlStr)
  return urlStr
}


/**
 * @param {Request} req 
 * @param {URL} urlObj
 * @param {URL} cliUrlObj 
 * @param {number} redirNum
 */
async function forward(req, urlObj, cliUrlObj, redirNum) {
  const {
    res, resOpt, cookies
  } = await network.launch(req, urlObj, cliUrlObj)

  const resStatus = resOpt.status
  const resHdrObj = resOpt.headers

  if (cookies) {
    sendMsgToPages(MSG.SW_COOKIE_PUSH, cookies)
  }

  // 空响应
  // https://fetch.spec.whatwg.org/#statuses
  if (resStatus === 101 ||
      resStatus === 204 ||
      resStatus === 205 ||
      resStatus === 304
  ) {
    return new Response(null, resOpt)
  }

  // 处理重定向
  if (resStatus === 301 ||
      resStatus === 302 ||
      resStatus === 303 ||
      resStatus === 307 ||
      resStatus === 308
  ) {
    const locStr = resHdrObj['location']
    if (locStr) {
      // 如果重定向到相对路径，则基于请求的 URL（不是页面的 URL）
      const locObj = urlx.newUrl(locStr, urlObj)
      if (locObj) {
        // 跟随模式，返回最终数据
        if (req.redirect === 'follow') {
          if (++redirNum === MAX_REDIR) {
            return makeErrRes('too many redirects')
          }
          return forward(req, locObj, cliUrlObj, redirNum)
        }
        // 不跟随模式（例如页面跳转），返回 30X 状态
        resHdrObj['location'] = urlx.encUrlObj(locObj)
      }
    }
    // firefox, safari 保留内容会提示页面损坏
    return new Response(null, resOpt)
  }

  //
  // 提取 mime 和 charset（不存在则为 undefined）
  // 可能存在多个段，并且值可能包含引号。例如：
  // content-type: text/html; ...; charset="gbk"
  //
  const ctVal = resHdrObj['content-type'] || ''
  const [, mime, charset] = ctVal
    .toLocaleLowerCase()
    .match(/([^;]*)(?:.*?charset=['"]?([^'"]+))?/)


  const type = req.destination
  if (type === 'script' ||
      type === 'worker' ||
      type === 'sharedworker'
  ) {
    const buf = await res.arrayBuffer()
    const ret = processJs(buf, charset)

    resHdrObj['content-type'] = 'text/javascript'
    return new Response(ret, resOpt)
  }

  if (req.mode === 'navigate' && mime === 'text/html') {
    return processHtml(res, resOpt, urlObj, true)
  }

  return new Response(res.body, resOpt)
}


async function proxy(e, urlObj) {
  // 使用 e.resultingClientId 有问题
  const id = e.clientId
  let cliUrlStr
  if (id) {
    cliUrlStr = idUrlMap.get(id) || await getUrlByClientId(id)
  }
  if (!cliUrlStr) {
    cliUrlStr = urlObj.href
  }
  const cliUrlObj = new URL(cliUrlStr)

  // try {
    return forward(e.request, urlObj, cliUrlObj, 0)
  // } catch (err) {
  //   console.warn('[jsproxy] forward err:', err)
  // }
}


self.addEventListener('fetch', e => {
  /** @type {Request} */
  const req = e.request
  const urlStr = req.url

  // homepage, or injected js
  if (urlStr.startsWith(env.PATH_ROOT) && 
    !urlStr.startsWith(env.PATH_PREFIX)) {
    return
  }

  const targetUrlStr = urlx.decUrlStrAbs(urlStr)
  const targetUrlObj = urlx.newUrl(targetUrlStr)

  let ret
  if (targetUrlObj) {
    ret = proxy(e, targetUrlObj)
  } else {
    ret = makeErrRes('invalid url: ' + targetUrlStr)
  }
  e.respondWith(ret)
})


self.addEventListener('message', e => {
  // console.log('sw msg:', e.data)
  const [cmd, val] = e.data

  switch (cmd) {
  case MSG.PAGE_COOKIE_PUSH:
    cookie.set(val)
    sendMsgToPages(MSG.SW_COOKIE_PUSH, [val], e.source.id)
    break
  case MSG.PAGE_COOKIE_PULL:
    // console.log('SW MSG.COOKIE_PULL:', e.source.id)
    sendMsg(e.source, MSG.SW_COOKIE_PUSH, cookie.getAll())
    break

  case MSG.PAGE_INIT_BEG:
    // console.log('SW MSG.PAGE_INIT_BEG:', val)
    pageNotify(val, false)
    break
  case MSG.PAGE_INIT_END:
    // console.log('SW MSG.PAGE_INIT_END:', val)
    pageNotify(val, true)
    break

  case MSG.SW_LIFE_ADD:
    // sw life +1s
    e.waitUntil(new Promise(cb => {
      setTimeout(_ => {
        sendMsg(sw, MSG.SW_LIFE_ADD)
        cb()
      }, 1000)
    }))
    break

  case MSG.PAGE_NODE_SWITCH:
    const ret = network.switchNode(val)
    if (ret) {
      console.log('[jsproxy] node switch to: %s', val)
    } else {
      console.warn('[jsproxy] invalid node name:', val)
    }
    sendMsgToPages(MSG.SW_NODE_SWITCHED, val)
    break
  case MSG.PAGE_NODE_GET:
    sendMsg(e.source, MSG.SW_NODE_SWITCHED, network.getNode())
    break
  }
})


self.addEventListener('install', e => {
  console.log('oninstall:', e)
	skipWaiting()
})


let sw

self.addEventListener('activate', e => {
  clients.claim()
  console.log('onactivate:', e)
  sw = registration.active
  sendMsgToPages(MSG.SW_READY, 1)
  sendMsg(sw, MSG.SW_LIFE_ADD)
})


console.log('[jsproxy] sw inited')
