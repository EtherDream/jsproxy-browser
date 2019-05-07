import * as conf from './conf.js'
import * as cookie from './cookie.js'
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

const directHostSet = new Set(conf.DIRECT_HOST)

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
 * @param {string[]} cookieStrArr 
 * @param {URL} urlObj 
 * @param {URL} cliUrlObj
 */
function procResCookie(cookieStrArr, urlObj, cliUrlObj) {
  if (!ENABLE_3RD_COOKIE) {
    const urlTld = tld.getTld(urlObj.hostname)
    const cliTld = tld.getTld(cliUrlObj.hostname)
    if (cliTld !== urlTld) {
      return
    }
  }
  return cookieStrArr
    .map(str => cookie.parse(str, urlObj))
    .filter(item => item && !item.httpOnly)
}


/**
 * @param {Headers} resHdrRaw 
 */
function getResInfo(resHdrRaw) {
  /** @type {string[]} */
  const cookieStrArr = []

  const headers = new Headers()
  let status = 0

  resHdrRaw.forEach((val, key) => {
    if (key === 'access-control-allow-origin' ||
        key === 'access-control-expose-headers') {
      return
    }
    // 原始状态码
    if (key === '--s') {
      status = +val
      return
    }
    if (key === '--t') {
      return
    }
    // 还原重名字段
    //  0-key: v1
    //  1-key: v2
    // =>
    //  key: v1, v2
    //
    // 对于 set-cookie 单独存储，因为合并会破坏 cookie 格式：
    //  var h = new Headers()
    //  h.append('set-cookie', 'hello')
    //  h.append('set-cookie', 'world')
    //  h.get('set-cookie')  // "hello, world"
    //
    const m = key.match(/^\d+-(.+)/)
    if (m) {
      key = m[1]
      if (key === 'set-cookie') {
        cookieStrArr.push(val)
      } else {
        headers.append(key, val)
      }
      return
    }

    // 还原转义字段（`--key` => `key`）
    if (key.startsWith('--')) {
      key = key.substr(2)
    }

    // 删除 vary 字段的 --url
    if (key === 'vary') {
      if (val === '--url') {
        return
      }
      val = val.replace('--url,', '')
    }

    headers.set(key, val)
  })

  return {status, headers, cookieStrArr}
}


/**
 * @param {Request} req 
 * @param {URL} urlObj 
 * @param {URL} cliUrlObj 
 */
function initReqHdr(req, urlObj, cliUrlObj) {
  const sysHdr = new Headers({
    '--ver': conf.JS_VER,
    '--url': urlx.delHash(urlObj.href),
    '--mode': req.mode,
    '--type': req.destination || '',
    '--level': '1',
  })
  const extHdr = {}
  let hasExtHdr = false

  req.headers.forEach((val, key) => {
    if (REQ_HDR_ALLOW.has(key)) {
      sysHdr.set(key, val)
    } else {
      extHdr[key] = val
      hasExtHdr = true
    }
  })

  if (sysHdr.has('origin')) {
    sysHdr.set('--origin', cliUrlObj.origin)
  } else {
    sysHdr.set('--origin', '')
  }

  const referer = req.referrer
  if (referer) {
    // TODO: CSS 引用图片的 referer 不是页面 URL，而是 CSS URL
    if (referer === REFER_ORIGIN) {
      // Referrer Policy: origin
      sysHdr.set('--referer', cliUrlObj.origin + '/')
    } else {
      sysHdr.set('--referer', urlx.decUrlStrAbs(referer))
    }
  }

  const cliTld = tld.getTld(cliUrlObj.hostname)
  const cookie = getReqCookie(urlObj, cliTld, req)
  if (cookie) {
    sysHdr.set('--cookie', cookie)
  }

  if (hasExtHdr) {
    sysHdr.set('--ext', JSON.stringify(extHdr))
  }
  if (isAcehOld) {
    sysHdr.set('--aceh', '1')
  }
  return sysHdr
}

/**
 * 直连的资源
 * 
 * @param {URL} urlObj 
 * @param {Request} req 
 * @param {RequestInit} reqOpt 
 */
async function proxyDirect(urlObj, req, reqOpt) {
  let hdr = req.headers

  // 从地址栏访问资源，请求头会出现该字段，导致出现 preflight
  if (hdr.has('upgrade-insecure-requests')) {
    hdr = new Headers(req.headers)
    hdr.delete('upgrade-insecure-requests')
  }
  reqOpt.headers = hdr

  try {
    const res = await fetch(urlObj.href, reqOpt)
    if (res.status === 200) {
      return res
    }
  } catch (err) {
  }
  console.warn('[jsproxy] direct proxy fail:', urlObj.href)
  return null
}

/**
 * @param {string} url
 * @param {*} reqOpt 
 */
async function proxyNode2(url, reqOpt) {
  try {
    var res = await fetch(url, reqOpt)
  } catch (err) {
    return null
  }

  if (res.status === 400) {
    const err = await res.text()
    console.warn('[jsproxy] proxy fail:', err)
    return null
  }

  const rawStatus = +res.headers.get('--s')
  if (rawStatus !== 200 && rawStatus !== 206) {
    console.warn('[jsproxy] proxy invalid status:', rawStatus)
    return null
  }

  return res
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

  /** @type {Response} */
  let res

  // 非 HTTP 协议的资源，直接访问
  // 例如 youtube 引用了 chrome-extension: 协议的脚本
  if (!urlx.isHttpProto(urlObj.protocol)) {
    reqOpt.headers = req.headers
    res = await fetch(req)
  }
  // 支持 cors 的资源，直接访问
  else if (
    method === 'GET' &&
    directHostSet.has(urlObj.host)
  ) {
    res = await proxyDirect(urlObj, req, reqOpt)
  }

  if (res) {
    return {
      res,
      status: res.status || 200,
      headers: new Headers(res.headers),
      cookies: null
    }
  }

  // 走代理，请求参数打包在头部字段
  const reqHdr = initReqHdr(req, urlObj, cliUrlObj)
  reqOpt.headers = reqHdr

  let level = 1
  let proxyUrl = genHttpUrl(urlObj, level)
  res = await fetch(proxyUrl, reqOpt)

  let resHdr = res.headers

  // 检测浏览器是否支持 aceh: *
  if (isAcehOld && resHdr.has('--t')) {
    isAcehOld = false
    reqHdr.delete('--aceh')
  }

  do {
    // 是否切换节点
    if (!resHdr.has('--switched')) {
      break
    }

    const rawInfo = resHdr.get('--raw-info')
    reqHdr.set('--raw-info', rawInfo)

    // TODO: 逻辑优化
    level++
    reqHdr.set('--level', level + '')
    proxyUrl = genHttpUrl(urlObj, level)
    res = await proxyNode2(proxyUrl, reqOpt)
    if (res) {
      break
    }

    // 切换失败，使用原节点
    // TODO: 尝试更多廉价节点，最坏情况才使用原节点
    reqHdr.set('--level', '0')
    proxyUrl = genHttpUrl(urlObj, 0)
    res = await fetch(proxyUrl, reqOpt)
  } while (0)

  const {
    status, headers, cookieStrArr
  } = getResInfo(res.headers)

  const cookies = cookieStrArr.length
    ? procResCookie(cookieStrArr, urlObj, cliUrlObj)
    : null

  return {res, status, headers, cookies}
}


/**
 * @param {URL} urlObj 
 * @param {number} level 
 */
export function genHttpUrl(urlObj, level) {
  let node = curNode

  // 临时测试
  if (/video/.test(urlObj.hostname)) {
    node = 'aliyun-sg'
  }

  if (level === 2) {
    node = 'cfworker'
  }

  let host = conf.getNodeHost(node)
  return `https://${host}/http`
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

  const host = conf.getNodeHost(curNode)
  return `wss://${host}/ws?` + new URLSearchParams(args)
}


// TODO: 临时测试
let curNode = conf.NODE_MAIN
