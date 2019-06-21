// https://publicsuffix.org/list/effective_tld_names.dat
import tldData from './tld-data.js'
import {isIPv4} from './util.js'


/** @type {Map<string, string>} */
const mTldCache = new Map()
const mTldSet = new Set(tldData.split(','))

/**
 * @param {string} domain 
 */
function getDomainTld(domain) {
  if (isTld(domain)) {
    return domain
  }
  let pos = 0
  for (;;) {
    // a.b.c -> b.c
    pos = domain.indexOf('.', pos + 1)
    if (pos === -1) {
      return ''
    }
    const str = domain.substr(pos + 1)
    if (isTld(str)) {
      return str
    }
  }
}

/**
 * @param {string} domain 
 */
export function getTld(domain) {
  let ret = mTldCache.get(domain)
  if (ret !== undefined) {
    return ret
  }

  if (isIPv4(domain)) {
    ret = domain
  } else {
    ret = getDomainTld(domain)
  }

  mTldCache.set(domain, ret)
  return ret
}


/**
 * @param {string} domain 
 */
export function isTld(domain) {
  return mTldSet.has(domain)
}