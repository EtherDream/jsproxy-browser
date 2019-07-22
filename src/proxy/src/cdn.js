import * as util from './util'

// 暂时先用 jsdelivr 试验。之后换成速度很快、容量更大的免费图床
const CDN = 'https://cdn.jsdelivr.net/npm/jsproxy-cache-01@0.0.'

let mCurVer = -1

/** @type {Map<number, number>} */
let mUrlHashVerMap = new Map()

/** @type {Set<string>} */
let mDirectHostSet = new Set()


async function loadDirectList(conf) {
  const url = conf.assets_cdn + conf.direct_host_list
  const res = await fetch(url)
  const txt = await res.text()

  for (const host of txt.split('\n')) {
    if (host && host[0] !== '#') {
      mDirectHostSet.add(host)
    }
  }
}

async function loadStaticList(conf) {
  const info = conf.static_boost
  if (!info || !info.enable) {
    return
  }
  const latest = info.ver
  if (mCurVer >= latest) {
    return
  }
  mCurVer = latest
  console.log('[jsproxy] cdn cache ver:', latest)

  const res = await fetch(CDN + latest + '/full')
  const buf = await res.arrayBuffer()
  const u32 = new Uint32Array(buf)

  let p = 0
  for (let ver = 0; ver <= latest; ver++) {
    const num = u32[p++]

    for (let i = 0; i < num; i++) {
      const urlHash = u32[p++]
      mUrlHashVerMap.set(urlHash, ver)
    }
  }
}


export function setConf(conf) {
  return Promise.all([
    loadStaticList(conf),
    loadDirectList(conf),
  ])
}

/**
 * @param {string} host 
 */
export function isDirectHost(host) {
  return mDirectHostSet.has(host)
}


/**
 * @param {string} url 
 */
export async function proxyDirect(url) {
  try {
    const res = await fetch(url, {
      referrerPolicy: 'no-referrer',
    })
    const {status} = res
    if (status === 200 || status === 206) {
      return res
    }
    console.warn('direct status:', status, url)
  } catch (err) {
    console.warn('direct fail:', url)
  }
}


/**
 * @param {number} urlHash 
 */
export function getFileVer(urlHash) {
  return mUrlHashVerMap.get(urlHash)
}


/**
 * @param {number} urlHash 
 * @param {number} urlVer 
 */
async function proxyStaticMain(urlHash, urlVer) {
  const hashHex = util.numToHex(urlHash, 8)
  const res = await fetch(CDN + urlVer + '/' + hashHex + '.txt')
  if (res.status !== 200) {
    throw 'bad status: ' + res.status
  }
  const buf = await res.arrayBuffer()
  const b = new Uint8Array(buf)

  const hdrLen = b[0] << 8 | b[1]
  const hdrBuf = b.subarray(2, 2 + hdrLen)
  const hdrStr = util.bytesToStr(hdrBuf)
  const hdrObj = JSON.parse(hdrStr)

  const body = b.subarray(2 + hdrLen)
  hdrObj['date'] = new Date().toUTCString()

  return new Response(body, {
    headers: hdrObj
  })
}


/**
 * @param {number} urlHash 
 * @param {number} urlVer 
 */
export async function proxyStatic(urlHash, urlVer) {
  // TODO: 使用多个 CDN
  try {
    return await proxyStaticMain(urlHash, urlVer)
  } catch(err) {
    console.warn('cdn fail:', err)
  }
}
