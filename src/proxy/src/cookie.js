const assign = Object.assign
const now = Date.now
const parseDate = Date.parse
const _isNaN = isNaN


function Cookie() {
  this.name = ''
  this.value = ''
  this.domain = ''
  this.hostOnly = false
  this.path = ''
  this.expires = NaN
  this.isExpired = false
  this.secure = false
  this.httpOnly = false
  this.sameSite = ''
}


/**
 * @param {string} cookiePath 
 * @param {string} urlPath 
 */
function isSubPath(cookiePath, urlPath) {
  if (urlPath === cookiePath) {
    return true
  }
  if (!cookiePath.endsWith('/')) {
    cookiePath += '/'
  }
  return urlPath.startsWith(cookiePath)
}


/**
 * @param {string} cookieDomain 
 * @param {string} urlDomain 
 */
function isSubDomain(cookieDomain, urlDomain) {
  return urlDomain === cookieDomain ||
    urlDomain.endsWith('.' + cookieDomain)
}


/**
 * @param {Cookie} item 
 * @param {number} tick
 */
function isExpired(item, tick) {
  const v = item.expires
  return !_isNaN(v) && v < tick
}


class CookieDomainNode {
  constructor() {
    /** @type {Cookie[]} */
    this.items = null

    /** @type {Object<string, CookieDomainNode>} */
    this.children = {}
  }

  /**
   * @param {string} cookie 
   */
  nextChild(name) {
    return this.children[name] || (
      this.children[name] = new CookieDomainNode
    )
  }

  /**
   * @param {string} cookie 
   */
  getChild(name) {
    return this.children[name]
  }

  /**
   * @param {Cookie} cookie 
   */
  addCookie(cookie) {
    if (this.items) {
      this.items.push(cookie)
    } else {
      this.items = [cookie]
    }
  }
}

/** @type {Map<string, Cookie>} */
const idCookieMap = new Map()

const cookieNodeRoot = new CookieDomainNode()



export function getAll() {
  /** @type {Cookie[]} */
  const ret = []
  idCookieMap.forEach(item => {
    if (!item.httpOnly) {
      ret.push(item)
    }
  })
  return ret
}


/**
 * @param {string} str 
 * @param {URL} urlObj 
 */
export function parse(str, urlObj) {
  const item = new Cookie()
  const arr = str.split(';')

  for (let i = 0; i < arr.length; i++) {
    let key, val
    const s = arr[i].trim()
    const p = s.indexOf('=')

    if (p !== -1) {
      key = s.substr(0, p)
      val = s.substr(p + 1)
    } else {
      //
      // cookie = 's; secure; httponly'
      //  0: { key: '', val: 's' }
      //  1: { key: 'secure', val: '' }
      //  2: { key: 'httponly', val: '' }
      //
      key = (i === 0) ? '' : s
      val = (i === 0) ? s : ''
    }

    if (i === 0) {
      item.name = key
      item.value = val
      continue
    }

    switch (key.toLocaleLowerCase()) {
    case 'expires':
      if (_isNaN(item.expires)) {
        item.expires = parseDate(val)
      }
      break
    case 'domain':
      if (val[0] === '.') {
        val = val.substr(1)
      }
      item.domain = val
      break
    case 'path':
      item.path = val
      break
    case 'httponly':
      item.httpOnly = true
      break
    case 'secure':
      item.secure = true
      break
    case 'max-age':
      item.expires = now() + val * 1000
      break
    case 'samesite':
      item.sameSite = val
      break
    }
  }

  const tick = now()
  if (isExpired(item, tick)) {
    item.isExpired = true
  }

  // https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Set-Cookie
  if (item.name.startsWith('__Secure-')) {
    if (!(
      urlObj.protocol === 'https:' &&
      item.secure
    )) {
      return
    }
  }
  if (item.name.startsWith('__Host-')) {
    if (!(
      urlObj.protocol === 'https:' &&
      item.secure &&
      item.domain === '' &&
      item.path === '/'
    )) {
      return
    }
  }

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#Compatibility_notes
  if (item.secure && urlObj.protocol === 'http:') {
    return
  }

  // check hostname
  const domain = urlObj.hostname

  if (item.domain) {
    if (!isSubDomain(item.domain, domain)) {
      console.warn('[jsproxy] invalid cookie domain! `%s` ⊄ `%s`',
        item.domain, domain)
      return
    }
  } else {
    item.domain = domain
    item.hostOnly = true
  }

  // check pathname
  const path = urlObj.pathname

  if (item.path) {
    if (!isSubPath(item.path, path)) {
      console.warn('[jsproxy] invalid cookie path! `%s` ⊄ `%s`',
        item.path, path)
      return
    }
  } else {
    item.path = path
  }

  set(item)
  return item
}


/**
 * @param {Cookie} item
 */
function getCookieId(item) {
  return (item.secure ? ';' : '') +
    item.name + ';' +
    item.domain +
    item.path
}


/**
 * @param {Cookie} item
 */
export function set(item) {
  // console.log('set:', item)
  const id = getCookieId(item)
  const matched = idCookieMap.get(id)

  if (matched) {
    if (item.isExpired) {
      // delete
      idCookieMap.delete(id)
      matched.isExpired = true
    } else {
      assign(matched, item)
    }
  } else {
    // create
    const labels = item.domain.split('.')
    let labelPos = labels.length
    let node = cookieNodeRoot
    do {
      node = node.nextChild(labels[--labelPos])
    } while (labelPos !== 0)
  
    node.addCookie(item)
    idCookieMap.set(id, item)
  }
}


/**
 * @param {URL} urlObj 
 */
export function concat(urlObj) {
  const ret = []
  const tick = now()
  const domain = urlObj.hostname
  const path = urlObj.pathname
  const isHttps = (urlObj.protocol === 'https:')


  const labels = domain.split('.')
  let labelPos = labels.length
  let node = cookieNodeRoot
  do {
    node = node.getChild(labels[--labelPos])
    if (!node) {
      break
    }
    const items = node.items
    items && items.forEach(item => {
      // https url | secure flag | carry
      //   ✔       |   ✔         |   ✔
      //   ✔       |   ✘         |   ✔
      //   ✘       |   ✘         |   ✔
      //   ✘       |   ✔         |   ✘
      if (!isHttps && item.secure) {
        return
      }
      // HostOnly Cookie 需匹配完整域名
      if (item.hostOnly && labelPos !== 0) {
        return
      }
      if (!isSubPath(item.path, path)) {
        return
      }
      if (isExpired(item, tick)) {
        item.isExpired = true
        return
      }
      // TODO: same site

      let str = item.value
      if (item.name) {
        str = item.name + '=' + str
      }
      ret.push(str)
    })
  } while (labelPos !== 0)

  return ret.join('; ')
}
