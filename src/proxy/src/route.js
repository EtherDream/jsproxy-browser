import * as urlx from './urlx.js'
import * as util from './util'


let mConf
let mNodeLinesMap

/**
 * @param {number} urlHash 
 * @param {string} id 
 * @returns {string}
 */
function getHostByNodeId(urlHash, id) {
  let a = 0
  for (const {weight, host} of mNodeLinesMap[id]) {
    if ((a += weight) > urlHash) {
      return host
    }
  }
}


/**
 * @param {string} host 
 */
function isLocalhost(host) {
  return /^(localhost|127\.\d+\.\d+\.\d+)([:/]|$)/.test(host)
}


/**
 * @param {number} urlHash 
 * @param {number} level 
 */
export function genHttpUrl(urlHash, level) {
  let node = mConf.node_default

  // 实验中...
  if (level === 2) {
    node = mConf.node_acc
  }

  let host = getHostByNodeId(urlHash, node)
  const s = isLocalhost(host) ? '' : 's'
  return `http${s}://${host}/http`
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
  args['ver__'] = mConf.ver

  const urlHash = util.strHash(urlObj.href)
  const host = getHostByNodeId(urlHash, mConf.node_default)
  const s = isLocalhost(host) ? '' : 's'
  return `ws${s}://${host}/ws?` + new URLSearchParams(args)
}


/**
 * @param {object} conf 
 */
export function setConf(conf) {
  mConf = conf
  mNodeLinesMap = {}

  for (const [id, info] of Object.entries(conf.node_map)) {
    const lines = []
    let weightSum = 0

    for (const [host, weight] of Object.entries(info.lines)) { 
      weightSum += weight
      lines.push({host, weight})
    }

    // 权重值按比例转换成 0 ~ 2^32 之间的整数，方便后续计算
    for (const v of lines) {
      v.weight = (v.weight / weightSum * 0xFFFFFFFF) >>> 0
    }
    lines.sort((a, b) => b.weight - a.weight)

    mNodeLinesMap[id] = lines
  }
}