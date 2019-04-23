import * as conf from './conf.js'
import * as cookie from './cookie.js'
import * as util from './util.js'
import * as urlx from './urlx.js'
import * as tld from './tld.js'

const REFER_ORIGIN = location.origin + '/'
const ENABLE_3RD_COOKIE = true

const REQ_HDR_ALLOW = new Set('accept,accept-charset,accept-encoding,accept-language,accept-datetime,authorization,cache-control,content-length,content-type,date,if-match,if-modified-since,if-none-match,if-range,if-unmodified-since,max-forwards,pragma,range,te,upgrade,upgrade-insecure-requests,origin,user-agent,x-requested-with,chrome-proxy'.split(','))


// 部分浏览器不支持 access-control-expose-headers: *
// https://developer.mz.jsproxy.tk/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers#Compatibility_notes
//
// 如果返回所有字段名，长度会很大。
// 因此请求头中设置 aceh__ 标记，告知服务器是否要返回所有字段名。
let isAcehOld = true

const whiteSet = new Set(conf.DIRECT_HOST)

/**
 * @param {URL} targetUrlObj 
 * @param {string} clientTld 
 * @param {Request} req 
 */
function getReqCookie(targetUrlObj, clientTld, req) {
  const cred = req.credentials
  if (cred === 'omit') {
    return
  }
  if (cred === 'same-origin') {
    // TODO:
    const targetTld = tld.getTld(targetUrlObj.hostname)
    if (targetTld !== clientTld) {
      return
    }
  }
  return cookie.concat(targetUrlObj)
}


/**
 * @param {Object<string, string | string[]>} headers 
 * @param {URL} urlObj 
 * @param {URL} cliUrlObj
 */
function procResCookie(headers, urlObj, cliUrlObj) {
  const x = headers['set-cookie']
  if (!x) {
    return
  }
  if (!ENABLE_3RD_COOKIE) {
    const urlTld = tld.getTld(urlObj.hostname)
    const cliTld = tld.getTld(cliUrlObj.hostname)
    if (cliTld !== urlTld) {
      return
    }
  }
  const arr = Array.isArray(x) ? x : [x]
  return arr
    .map(str => cookie.parse(str, urlObj))
    .filter(item => item && !item.httpOnly)
}


/**
 * @param {Headers} resHdr 
 * @return {ResponseInit}
 */
function getResInfo(resHdr) {
  const headers = {}
  let status = 0

  resHdr.forEach((val, key) => {
    if (key === 'access-control-allow-origin' ||
        key === 'access-control-expose-headers') {
      return
    }
    // 原始状态码
    if (key === '--s') {
      status = +val
      return
    }
    // 该字段用于测试浏览器是否支持 aceh: *
    if (key === '--t') {
      isAcehOld = false
      console.log('[jsproxy] support ACEH *')
      return
    }
    // 重名字段，转成数组
    const m = key.match(/^\d+-(.+)/)
    if (m) {
      const k = m[1]
      const arr = headers[k]
      if (Array.isArray(arr)) {
        arr.push(val)
      } else {
        headers[k] = [val]
      }
      return
    }
    // 转义字段
    if (key.startsWith('--')) {
      key = key.substr(2)
    }
    headers[key] = val
  })

  return {status, headers}
}


/**
 * @param {Request} req 
 * @param {URL} urlObj 
 * @param {URL} cliUrlObj 
 */
function initReqHdr(req, urlObj, cliUrlObj) {
  const sysHdr = {
    '--ver': conf.JS_VER,
    '--url': urlx.delHash(urlObj.href),
  }
  const extHdr = {}
  let hasExtHdr = false

  req.headers.forEach((val, key) => {
    if (REQ_HDR_ALLOW.has(key)) {
      sysHdr[key] = val
    } else {
      extHdr[key] = val
      hasExtHdr = true
    }
  })

  if (sysHdr['origin']) {
    sysHdr['--origin'] = cliUrlObj.origin
  } else {
    sysHdr['--origin'] = ''
  }

  const referer = req.referrer
  if (referer) {
    // TODO: CSS 引用图片的 referer 不是页面 URL，而是 CSS URL
    if (referer === REFER_ORIGIN) {
      // Referrer Policy: origin
      sysHdr['--referer'] = cliUrlObj.origin + '/'
    } else {
      sysHdr['--referer'] = urlx.decUrlStrAbs(referer)
    }
  }

  const cliTld = tld.getTld(cliUrlObj.hostname)
  const cookie = getReqCookie(urlObj, cliTld, req)
  if (cookie) {
    sysHdr['--cookie'] = cookie
  }

  if (hasExtHdr) {
    sysHdr['--ext'] = JSON.stringify(extHdr)
  }
  if (isAcehOld) {
    sysHdr['--aceh'] = '1'
  }
  return sysHdr
}


/**
 * @param {Request} req 
 * @param {URL} urlObj 
 * @param {URL} cliUrlObj 
 */
export async function launch(req, urlObj, cliUrlObj) {
  const {
    method
  } = req

  /** @type {RequestInit} */
  const reqOpt = {
    mode: 'cors',
    referrerPolicy: 'no-referrer',
    method,
  }

  if (method === 'POST' && !req.bodyUsed) {
    const buf = await req.arrayBuffer()
    if (buf.byteLength > 0) {
      reqOpt.body = buf
    }
  }

  if (req.signal) {
    reqOpt.signal = req.signal
  }

  let res, resOpt, cookies

  do {
    // TODO: 逻辑调整。
    if (method === 'GET' && whiteSet.has(urlObj.host)) {
      // 白名单资源直接访问
      reqOpt.headers = req.headers
      try {
        res = await fetch(urlObj, reqOpt)
        if (res.status === 200) {
          break
        }
      } catch (err) {
      }
      console.warn('[jsproxy] direct fetch fail:', urlObj.href)
    }

    const proxyUrl = genHttpUrl(urlObj)
    if (!proxyUrl) {
      // 非 HTTP 类型，比如 chrome-extension:
      reqOpt.headers = req.headers
      res = await fetch(urlObj, reqOpt)
      break
    }

    // 代理
    reqOpt.headers = initReqHdr(req, urlObj, cliUrlObj)
    res = await fetch(proxyUrl, reqOpt)
    resOpt = getResInfo(res.headers)

    cookies = procResCookie(resOpt.headers, urlObj, cliUrlObj)
  } while (0)

  resOpt = resOpt || {
    status: res.status,
    headers: res.headers,
  }
  return {res, resOpt, cookies}
}


/**
 * @param {URL} urlObj 
 */
export function genHttpUrl(urlObj) {
  if (!urlx.isHttpProto(urlObj.protocol)) {
    return null
  }
  return `https://${curHost}/http`
}


/**
 * @param {URL} urlObj 
 * @param {Object<string, string>} args 
 */
export function genWsUrl(urlObj, args) {
  let scheme = 'https'
  switch (urlObj.protocol) {
  case 'wss:':
    break
  case 'ws:':
    scheme = 'http'
    break
  default:
    return null
  }

  const t = urlx.delScheme(urlx.delHash(urlObj.href))
  args['url__'] = scheme + '://' + t
  args['ver__'] = conf.JS_VER

  return `wss://${curHost}/ws?` + new URLSearchParams(args)
}


// TODO: 临时测试
let curNode = conf.NODE_DEF
let curHost = conf.NODE_MAP[curNode]

/**
 * @param {string} node 
 */
export function switchNode(node) {
  const host = conf.NODE_MAP[node]
  if (!host) {
    return false
  }
  curNode = node
  curHost = host
  return true
}


export function getNode() {
  return curNode
}