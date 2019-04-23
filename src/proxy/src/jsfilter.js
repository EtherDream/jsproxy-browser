import * as util from './util.js'


/**
 * @param {string} code 
 */
export function parseStr(code) {
  // TODO: parse js ast
  let match = false

  code = code.replace(/(\b)location(\b)/g, (_, $1, $2) => {
    match = true
    return $1 + '__location' + $2
  })
  code = code.replace(/postMessage\s*\(/g, s => {
    match = true
    return s + '...__set_srcWin(), '
  })
  if (match) {
    return code
  }
  return null
}

/**
 * @param {Uint8Array} buf
 * @param {string} charset
 */
export function parseBin(buf, charset) {
  const str = util.bytesToStr(buf, charset)
  const ret = parseStr(str)
  if (ret !== null) {
    return util.strToBytes(ret)
  }
  if (charset && !util.isUtf8(charset)) {
    return util.strToBytes(str)
  }
  return null
}