import tldData from './tld-data.js'
import {isIPv4} from './util.js'


/** @type {Map<string, string>} */
const tldCache = new Map()
const tldSet = new Set(tldData.split(','))


/**
 * @param {string} domain 
 */
export function getTld(domain) {
  let ret = tldCache.get(domain)
  if (ret) {
    return ret
  }
  if (!isIPv4(domain) && !isTld(domain)) {
    let pos = 0
    for (;;) {
      // a.b.c -> b.c
      pos = domain.indexOf('.', pos + 1)
      if (pos === -1) {
        break
      }
      const str = domain.substr(pos + 1)
      if (isTld(str)) {
        domain = str
        break
      }
    }
  }
  tldCache.set(domain, ret)
  return domain
}


/**
 * @param {string} domain 
 */
export function isTld(domain) {
  return tldSet.has(domain)
}