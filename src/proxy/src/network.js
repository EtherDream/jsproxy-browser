import * as route from './route.js'
import * as cookie from './cookie.js'
import * as urlx from './urlx.js'
import * as util from './util'
import * as tld from './tld.js'


let conf

const REFER_ORIGIN = location.origin + '/'
const ENABLE_3RD_COOKIE = true

const REQ_HDR_ALLOW = new Set('accept,accept-charset,accept-encoding,accept-language,accept-datetime,authorization,cache-control,content-length,content-type,date,if-match,if-modified-since,if-none-match,if-range,if-unmodified-since,max-forwards,pragma,range,te,upgrade,upgrade-insecure-requests,origin,user-agent,x-requested-with,chrome-proxy'.split(','))


// 部分浏览器不支持 access-control-expose-headers: *
// https://developer.mz.jsproxy.tk/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers#Compatibility_notes
//
// 如果返回所有字段名，长度会很大。
// 因此请求头中设置 aceh__ 标记，告知服务器是否要返回所有字段名。
let isAcehOld = true

let directHostSet


export function setConf(v) {
  conf = v
  // TODO:
  directHostSet = new Set([])
}


/**
 * @param {URL} targetUrlObj 
 * @param {URL} clientUrlObj 
 * @param {Request} req 
 */
function getReqCookie(targetUrlObj, clientUrlObj, req) {
  const cred = req.credentials
  if (cred === 'omit') {
    return ''
  }
  if (cred === 'same-origin') {
    // TODO:
    const targetTld = tld.getTld(targetUrlObj.hostname)
    const clientTld = tld.getTld(clientUrlObj.hostname)
    if (targetTld !== clientTld) {
      return ''
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
 * @param {Response} res 
 */
function getResInfo(res) {
  const resHdrRaw = res.headers

  /** @type {string[]} */
  const cookieStrArr = []

  const headers = new Headers()

  let status = res.status
  if (status === 311 ||
      status === 312 ||
      status === 313 ||
      status === 317 ||
      status === 318
  ) {
    status -= 10
  }

  resHdrRaw.forEach((val, key) => {
    if (key === 'access-control-allow-origin' ||
        key === 'access-control-expose-headers') {
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
    // 对于 set-cookie 单独存储，因为合并会破坏 cookie 格式：
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
    '--ver': conf.ver,
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

  const cookie = getReqCookie(urlObj, cliUrlObj, req)
  sysHdr.set('--cookie', cookie)

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
    hdr = new Headers(hdr)
    hdr.delete('upgrade-insecure-requests')
  }
  reqOpt.headers = hdr

  try {
    const res = await fetch(urlObj.href, reqOpt)
    if (res.status === 200 || res.status === 206) {
      return res
    }
    console.warn('[jsproxy] proxyDirect invalid status:', res.status, urlObj.href)
  } catch (err) {
    console.warn('[jsproxy] proxyDirect fail:', urlObj.href)
  }
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

  if (res.status !== 200 && res.status !== 206) {
    console.warn('[jsproxy] proxy invalid status:', res.status)
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

  const urlHash = util.strHash(urlObj.href)

  /** @type {Response} */
  let res

  if (!urlx.isHttpProto(urlObj.protocol)) {
    // 非 HTTP 协议的资源，直接访问
    // 例如 youtube 引用了 chrome-extension: 协议的脚本
    res = await fetch(req)
  }
  else if (method === 'GET') {
    if (directHostSet.has(urlObj.host)) {
      // 支持 cors 的资源
      // 有些服务器配置了 acao: *，直连可加速
      res = await proxyDirect(urlObj, req, reqOpt)
    }
    else {
      // 本地 CDN 加速
      // 一些大网站常用的静态资源存储在 jsdelivr 上
      const fileID = getCdnFileId(urlHash)
      if (fileID !== -1) {
        res = await proxyFromCdn(fileID)
        console.log('cdn hit:', urlObj.href)
      }
    }
  }

  if (res) {
    return {
      res,
      status: res.status || 200,
      headers: new Headers(res.headers),
    }
  }

  // 以上都不可用，走自己的代理服务器
  // 请求参数打包在头部字段
  const reqHdr = initReqHdr(req, urlObj, cliUrlObj)
  reqOpt.headers = reqHdr

  let level = 1
  let proxyUrl = route.genHttpUrl(urlHash, level)
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
    proxyUrl = route.genHttpUrl(urlHash, level)

    res = await proxyNode2(proxyUrl, reqOpt)
    if (res) {
      break
    }

    // 切换失败，使用原节点
    // TODO: 尝试更多廉价节点，最坏情况才使用原节点
    reqHdr.set('--level', '0')
    proxyUrl = route.genHttpUrl(urlHash, 0)
    res = await fetch(proxyUrl, reqOpt)
  } while (0)

  const {
    status, headers, cookieStrArr
  } = getResInfo(res)

  let cookies
  if (cookieStrArr.length) {
    cookies = procResCookie(cookieStrArr, urlObj, cliUrlObj)
  }

  return {res, status, headers, cookies}
}


const CDN = 'https://cdn.jsdelivr.net/gh/zjcqoo/cache@'

/** @type {Uint32Array} */
let gCdnUrlHashList



export async function loadManifest() {
  // TODO: 记录每个资源的版本号
  const res = await fetch(CDN + '5/list.txt')
  const buf = await res.arrayBuffer()
  gCdnUrlHashList = new Uint32Array(buf)
}


/**
 * @param {number} urlHash 
 */
export function getCdnFileId(urlHash) {
  if (!gCdnUrlHashList) {
    return -1
  }
  const fileId = util.binarySearch(gCdnUrlHashList, urlHash)
  return fileId
}


/**
 * @param {number} id 
 */
export async function proxyFromCdn(id) {
  const urlHash = gCdnUrlHashList[id]
  const hashHex = util.numToHex(urlHash, 8)

  try {
    const res = await fetch(CDN + '5/' + hashHex + '.txt')
    var buf = await res.arrayBuffer()
  } catch (err) {
    console.warn('[jsproxy] proxyFromCdn fail')
    return
  }

  const b = new Uint8Array(buf)
  
  const hdrLen = b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]
  const hdrBuf = b.subarray(4, 4 + hdrLen)
  const hdrStr = util.bytesToStr(hdrBuf)
  const hdrObj = JSON.parse(hdrStr)

  const body = b.subarray(4 + hdrLen)
  hdrObj['date'] = new Date().toUTCString()

  return new Response(body, {
    status: 200,
    headers: hdrObj
  })
}
