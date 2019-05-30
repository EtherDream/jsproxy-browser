import * as urlx from './urlx.js'
import * as util from './util'


let conf

/**
 * @param {number} urlHash 
 * @param {string} id 
 * @returns {string}
 */
function getHostByNodeId(urlHash, id) {
  const lines = conf.node_map[id].lines
  return lines[urlHash % lines.length]
}


/**
 * @param {number} urlHash 
 * @param {number} level 
 */
export function genHttpUrl(urlHash, level) {
  let node = conf.node_default

  // 实验中...
  if (level === 2) {
    node = conf.node_acc
  }

  let host = getHostByNodeId(urlHash, node)
  const s = /^localhost:?/.test(host) ? '' : 's'
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
  args['ver__'] = conf.ver

  const urlHash = util.strHash(urlObj.href)
  const host = getHostByNodeId(urlHash, conf.node_default)
  const s = /^localhost:?/.test(host) ? '' : 's'
  return `ws${s}://${host}/ws?` + new URLSearchParams(args)
}


/**
 * @param {object} v 
 */
export function setConf(v) {
  conf = v
}