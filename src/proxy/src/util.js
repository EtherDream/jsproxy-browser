const ENC = new TextEncoder()

/**
 * @param {string} str 
 */
export function strToBytes(str) {
  return ENC.encode(str)
}

/**
 * @param {BufferSource} bytes 
 * @param {string} charset 
 */
export function bytesToStr(bytes, charset = 'utf-8') {
  return new TextDecoder(charset).decode(bytes)
}

/**
 * @param {string} label 
 */
export function isUtf8(label) {
  return /^utf-?8$/i.test(label)
}


const R_IP = /^(?:\d+\.){0,3}\d+$/

/**
 * @param {string} str 
 */
export function isIPv4(str) {
  return R_IP.test(str)
}


const JS_MIME_SET = new Set([
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'application/x-ecmascript',
  'module',
])

/**
 * @param {string} mime 
 */
export function isJsMime(mime) {
  return JS_MIME_SET.has(mime)
}


/**
 * 将多个 Uint8Array 拼接成一个
 * @param {Uint8Array[]} bufs 
 */
export function concatBufs(bufs) {
  let size = 0
  bufs.forEach(v => {
    size += v.length
  })

  let ret = new Uint8Array(size)
  let pos = 0
  bufs.forEach(v => {
    ret.set(v, pos)
    pos += v.length
  })
  return ret
}
