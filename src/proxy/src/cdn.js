import * as util from './util'


const CDN = 'https://cdn.jsdelivr.net/npm/jsproxy-cache-01@0.0.'

let mCurVer = -1

/** @type {Map<number, number>} */
let mUrlHashVerMap = new Map()


export async function setConf(conf) {
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
export async function proxy(urlHash, urlVer) {
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
    status: 200,
    headers: hdrObj
  })
}
