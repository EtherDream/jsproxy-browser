import * as urlx from './urlx.js'
import * as util from './util'


let conf
let curNode = ''

/**
 * @param {number} urlHash 
 * @param {string} id 
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
  let node = curNode

  // 实验中...
  if (level === 2) {
    node = conf.node_acc
  }

  let host = getHostByNodeId(urlHash, node)
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
  args['ver__'] = conf.ver

  const urlHash = util.strHash(urlObj.href)
  const host = getHostByNodeId(urlHash, curNode)

  return `wss://${host}/ws?` + new URLSearchParams(args)
}


/**
 * @param {string} id 
 */
export function hasNode(id) {
  return !!conf.node_map[id]
}


/**
 * @param {string} id 
 */
export function setNode(id) {
  curNode = id
}


export function getNode() {
  return curNode
}


/**
 * @param {object} v 
 */
export function setConf(v) {
  conf = v
  curNode = conf.node_default
}