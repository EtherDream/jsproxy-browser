import * as route from './route.js'
import * as cookie from './cookie.js'
import * as urlx from './urlx.js'
import * as util from './util'
import * as tld from './tld.js'
import * as cdn from './cdn.js'
import {Database} from './database.js'


const REFER_ORIGIN = location.origin + '/'
const ENABLE_3RD_COOKIE = true

const REQ_HDR_ALLOW = new Set('accept,accept-charset,accept-encoding,accept-language,accept-datetime,authorization,cache-control,content-length,content-type,date,if-match,if-modified-since,if-none-match,if-range,if-unmodified-since,max-forwards,pragma,range,te,upgrade,upgrade-insecure-requests,origin,user-agent,x-requested-with,chrome-proxy'.split(','))

/** @type {Database} */
let mDB


// 部分浏览器不支持 access-control-expose-headers: *
// https://developer.mz.jsproxy.tk/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers#Compatibility_notes
//
// 如果返回所有字段名，长度会很大。
// 因此请求头中设置 aceh__ 标记，告知服务器是否要返回所有字段名。
let mIsAcehOld = true

// TODO:
let mConf


export function setConf(conf) {
  mConf = conf
  cdn.setConf(conf)
}


export async function setDB(db) {
  mDB = db
  // clear expires
}


/**
 * @param {string} url 
 */
function getUrlCache(url) {
  return mDB.get('url-cache', url)
}


/**
 * @param {string} url 
 * @param {string} host 
 * @param {string} info 
 * @param {number} expires 
 */
async function setUrlCache(url, host, info, expires) {
  await mDB.put('url-cache', {url, host, info, expires})
}


/**
 * @param {string} url 
 */
async function delUrlCache(url) {
  await mDB.delete('url-cache', url)
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
  return cookie.query(targetUrlObj)
}


/**
 * @param {Headers} header 
 */
function parseResCache(header) {
  const cacheStr = header.get('cache-control')
  if (cacheStr) {
    if (/no-cache/i.test(cacheStr)) {
      return -1
    }
    const m = cacheStr.match(/(?:^|,\s*)max-age=["]?(\d+)/i)
    if (m) {
      const sec = +m[1]
      if (sec > 0) {
        return sec
      }
    }
  }
  const expires = header.get('expires')
  if (expires) {
    const ts = Date.parse(expires)
    if (ts > 0) {
      return (ts - Date.now()) / 1000 | 0
    }
  }
  return 0
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

  const ret = []
  const now = Date.now()

  for (const str of cookieStrArr) {
    const item = cookie.parse(str, urlObj, now)
    if (!item) {
      continue
    }
    cookie.set(item)
    if (!item.httpOnly) {
      ret.push(item)
    }
  }
  return ret
}


/**
 * @param {Response} res 
 */
function getResInfo(res) {
  const rawHeaders = res.headers
  let status = res.status

  /** @type {string[]} */
  const cookieStrArr = []
  const headers = new Headers()

  rawHeaders.forEach((val, key) => {
    if (key === 'access-control-allow-origin' ||
        key === 'access-control-expose-headers') {
      return
    }
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

    // 单个 set-cookie 返回头
    if (key === 'set-cookie') {
      cookieStrArr.push(val)
      return
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
    '--ver': mConf.ver,
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
  if (mIsAcehOld) {
    sysHdr.set('--aceh', '1')
  }
  return sysHdr
}


const MAX_RETRY = 5

/**
 * @param {Request} req 
 * @param {URL} urlObj 
 * @param {URL} cliUrlObj 
 */
export async function launch(req, urlObj, cliUrlObj) {
  const {method} = req

  /** @type {RequestInit} */
  const reqOpt = {
    mode: 'cors',
    referrerPolicy: 'no-referrer',
    method,
  }

  if (method === 'POST' && !req.bodyUsed) {
    if (req.body) {
      reqOpt.body = req.body
    } else {
      const buf = await req.arrayBuffer()
      if (buf.byteLength > 0) {
        reqOpt.body = buf
      }
    }
  }

  if (req.signal) {
    reqOpt.signal = req.signal
  }

  if (!urlx.isHttpProto(urlObj.protocol)) {
    // 非 HTTP 协议的资源，直接访问
    // 例如 youtube 引用了 chrome-extension: 协议的脚本
    const res = await fetch(req)
    return {res}
  }

  const url = urlObj.href
  const urlHash = util.strHash(url)
  let host = ''
  let rawInfo = ''

  const reqHdr = initReqHdr(req, urlObj, cliUrlObj)
  reqOpt.headers = reqHdr

  while (method === 'GET') {
    // 该资源是否加载过？
    const r = await getUrlCache(url)
    if (r && r.host) {
      const now = util.getTimeSeconds()
      if (now < r.expires) {
        // 使用之前的节点，提高缓存命中率
        host = r.host
        rawInfo = r.info
        break
      }
    }

    // 支持 CORS 的站点，可直连
    if (cdn.isDirectHost(urlObj.host)) {
      console.log('direct hit:', url)
      const res = await cdn.proxyDirect(url)
      if (res) {
        setUrlCache(url, '', '', 0)
        return {res}
      }
    }

    // 常用静态资源 CDN 加速
    const ver = cdn.getFileVer(urlHash)
    if (ver >= 0) {
      console.log('cdn hit:', url)
      const res = await cdn.proxyStatic(urlHash, ver)
      if (res) {
        setUrlCache(url, '', '', 0)
        return {res}
      }
    }

    break
  }

  // TODO: 此处逻辑需要优化
  let level = 1

  // 如果缓存未命中产生请求，服务器不做节点切换
  if (host) {
    level = 0
  }

  /** @type {Response} */
  let res

  /** @type {Headers} */
  let resHdr


  for (let i = 0; i < MAX_RETRY; i++) {
    if (i === 0 && host) {
      // 使用缓存的主机
    } else {
      host = route.getHost(urlHash, level)
    }
    const proxyUrl = route.genUrl(host, 'http')

    // 即使未命中缓存，在请求“加速节点”时也能带上文件信息
    if (rawInfo) {
      reqHdr.set('--raw-info', rawInfo)
    } else {
      reqHdr.delete('--raw-info')
    }

    res = null
    try {
      res = await fetch(proxyUrl, reqOpt)
    } catch (err) {
      console.warn('fetch fail:', proxyUrl)
      break
      // TODO: 重试其他线路
      // route.setFailHost(host)
    }
    resHdr = res.headers

    // 检测浏览器是否支持 aceh: *
    if (mIsAcehOld && resHdr.has('--t')) {
      mIsAcehOld = false
      reqHdr.delete('--aceh')
    }

    // 是否切换节点
    if (resHdr.has('--switched')) {
      rawInfo = resHdr.get('--raw-info')
      reqHdr.set('--level', ++level + '')
      continue
    }

    // 目前只有加速节点会返回该信息
    const resErr = resHdr.get('--error')
    if (resErr) {
      console.warn('[jsproxy] cfworker fail:', resErr)
      rawInfo = ''
      level = 0
      continue
    }

    break
  }

  if (!res) {
    return
  }

  const {
    status, headers, cookieStrArr
  } = getResInfo(res)


  if (method === 'GET' && status === 200) {
    const cacheSec = parseResCache(headers)
    if (cacheSec >= 0) {
      const expires = util.getTimeSeconds() + cacheSec + 1000
      setUrlCache(url, host, rawInfo, expires)
    }
  }

  // 处理 HTTP 返回头的 refresh 字段
  // http://www.otsukare.info/2015/03/26/refresh-http-header
  const refresh = headers.get('refresh')
  if (refresh) {
    const newVal = urlx.replaceHttpRefresh(refresh, url)
    if (newVal !== refresh) {
      console.log('[jsproxy] http refresh:', refresh)
      headers.set('refresh', newVal)
    }
  }

  let cookies
  if (cookieStrArr.length) {
    const items = procResCookie(cookieStrArr, urlObj, cliUrlObj)
    if (items.length) {
      cookies = items
    }
  }

  return {res, status, headers, cookies}
}
