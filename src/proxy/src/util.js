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


/**
 * @param {string} str 
 */
export function strHash(str) {
  let sum = 0
  for (let i = 0, n = str.length; i < n; i++) {
    sum = (sum * 31 + str.charCodeAt(i)) >>> 0
  }
  return sum
}


/**
 * 使用二分法查找数组中的元素
 * 
 * @param {ArrayLike<number>} arr 已排序的数组
 * @param {number} el 需查询的元素
 * @returns 返回元素所在位置，不存在则返回 -1
 */
export function binarySearch(arr, el) {
  let m = 0
  let n = arr.length - 1

  while (m <= n) {
    // k = Math.floor((n + m) / 2)
    const k = (n + m) >> 1
    const cmp = el - arr[k]
    if (cmp > 0) {
      m = k + 1
    } else if (cmp < 0) {
      n = k - 1
    } else {
      return k
    }
  }
  return -1
}


/**
 * @param {number} num 
 * @param {number} len 
 */
export function numToHex(num, len) {
  return ('00000000' + num.toString(16)).slice(-len)
}


/**
 * @param {number} ms 
 */
export async function sleep(ms) {
  return new Promise(y => setTimeout(y, ms))
}