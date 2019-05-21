import * as urlx from "./urlx";

const {
  defineProperty,
  setPrototypeOf,
} = Object


function setup(obj, fakeLoc) {
  defineProperty(obj, '__location', {
    get() {
      return fakeLoc
    },
    set(val) {
      console.log('[jsproxy] %s set location: %s', obj, val)
      fakeLoc.href = val
    }
  })
}


/**
 * @param {Window} global  WindowOrWorkerGlobalScope
 */
export function createFakeLoc(global) {
  const location = global.location
  let ancestorOrigins

  /**
   * @param {Location | URL} loc 
   */
  function getPageUrlObj(loc) {
    return new URL(urlx.decUrlObj(loc))
  }


  // 不缓存 location 属性，因为 beforeunload 事件会影响赋值
  const locObj = {
    get href() {
      // console.log('[jsproxy] get location.href')
      return getPageUrlObj(location).href
    },

    // TODO: 精简合并
    get protocol() {
      return getPageUrlObj(location).protocol
    },

    get host() {
      return getPageUrlObj(location).host
    },

    get hostname() {
      return getPageUrlObj(location).hostname
    },

    get port() {
      return getPageUrlObj(location).port
    },

    get pathname() {
      return getPageUrlObj(location).pathname
    },

    get search() {
      return getPageUrlObj(location).search
    },

    get hash() {
      return getPageUrlObj(location).hash
    },

    get origin() {
      return getPageUrlObj(location).origin
    },

    toString() {
      return this.href
    },

    toLocaleString() {
      return this.href
    },

    // TODO: Worker 中没有以下属性
    get ancestorOrigins() {
      if (!ancestorOrigins) {
        // TODO: DOMStringList[]
        ancestorOrigins = []

        let p = global
        while ((p = p.parent) !== top) {
          const u = getPageUrlObj(p.location)
          ancestorOrigins.unshift(u.origin)
        }
      }
      return ancestorOrigins
    },

    set href(val) {
      console.log('[jsproxy] set location.href:', val)
      location.href = urlx.encUrlStrRel(val, this)
    },

    set protocol(val) {
      console.log('[jsproxy] set location.protocol:', val)
      const urlObj = getPageUrlObj(location)
      urlObj.href = val
      location.href = urlx.encUrlObj(urlObj)
    },

    set host(val) {
      console.log('[jsproxy] set location.host:', val)
      const urlObj = getPageUrlObj(location)
      urlObj.host = val
      location.href = urlx.encUrlObj(urlObj)
    },

    set hostname(val) {
      console.log('[jsproxy] set location.hostname:', val)
      const urlObj = getPageUrlObj(location)
      urlObj.hostname = val
      location.href = urlx.encUrlObj(urlObj)
    },

    set port(val) {
      console.log('[jsproxy] set location.port:', val)
      const urlObj = getPageUrlObj(location)
      urlObj.port = val
      location.href = urlx.encUrlObj(urlObj)
    },

    set pathname(val) {
      console.log('[jsproxy] set location.pathname:', val)
      const urlObj = getPageUrlObj(location)
      urlObj.pathname = val
      location.href = urlx.encUrlObj(urlObj)
    },

    set search(val) {
      location.search = val
    },

    set hash(val) {
      location.hash = val
    },

    reload() {
      console.warn('[jsproxy] location.reload')
      // @ts-ignore
      return location.reload(...arguments)
    },

    replace(val) {
      if (val) {
        console.warn('[jsproxy] location.replace:', val)
        arguments[0] = urlx.encUrlStrRel(val, this)
      }
      // @ts-ignore
      return location.replace(...arguments)
    },

    assign(val) {
      if (val) {
        console.warn('[jsproxy] location.assign:', val)
        arguments[0] = urlx.encUrlStrRel(val, this)
      }
      // @ts-ignore
      return location.assign(...arguments)
    },
  }

  const locProto = location.constructor.prototype
  const fakeLoc = setPrototypeOf(locObj, locProto)
  setup(global, fakeLoc)

  // 非 Worker 环境
  const Document = global['Document']
  if (Document) {
    // TODO: document.hasOwnProperty('location') 原本是 true
    setup(Document.prototype, fakeLoc)
  }

  return fakeLoc
}
