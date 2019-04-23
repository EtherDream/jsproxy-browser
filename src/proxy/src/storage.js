import {
  func as hookFunc,
} from './hook.js'

const {
  apply,
  defineProperty,
  ownKeys,
  getOwnPropertyDescriptor,
} = Reflect

const undefined = void 0


/**
 * @param {Window} win 
 * @param {string} name 
 * @param {string} origin 
 */
function setup(win, name, origin) {
  /** @type {Storage} */
  const raw = win[name]
  if (!raw) {
    return
  }
  const prefix = origin + ':'
  const prefixLen = prefix.length

  const nativeMap = {
    getItem,
    setItem,
    removeItem,
    clear,
    key,
    constructor: raw.constructor,
    toString: () => raw.toString(),
    get length() {
      return ownKeys(raw)
        .filter(v => v.startsWith(prefix))
        .length
    },
  }
  
  /**
   * @param {string} key 
   */
  function getItem(key) {
    return raw.getItem(prefix + key)
  }

  /**
   * @param {string} key 
   * @param {string} value 
   */
  function setItem(key, val) {
    // TODO: 同步到 indexedDB
    raw.setItem(prefix + key, val)
  }

  /**
   * @param {string} key 
   */
  function removeItem(key) {
    return raw.removeItem(prefix + key)
  }

  function clear() {
    getAllKeys().forEach(removeItem)
  }

  /**
   * @param {*} val
   */
  function key(val) {
    // TODO: 无需遍历所有
    const arr = getAllKeys()
    const ret = arr[val | 0]
    if (ret === undefined) {
      return null
    }
    return ret
  }


  /**
   * @returns {string[]}
   */
  function getAllKeys() {
    return ownKeys(raw)
      .filter(v => v.startsWith(prefix))
      .map(v => v.substr(prefixLen))
  }

  const storage = new Proxy(raw, {
    get(obj, key) {
      const val = nativeMap[key]
      if (val !== undefined) {
        return val
      }
      console.log('[jsproxy] %s get: %s', name, key)
      const ret = getItem(key)
      if (ret === null) {
        return undefined
      }
      return ret
    },
    set(obj, key, val) {
      if (key in nativeMap) {
        nativeMap[key] = val
        return
      }
      console.log('[jsproxy] %s set: %s = %s', name, key, val)
      setItem(key, val)
      return true
    },
    deleteProperty(obj, key) {
      console.log('[jsproxy] %s del: %s', name, key)
      return removeItem(key)
    },
    has(obj, key) {
      console.log('[jsproxy] %s has: %s', name, key)
      return (prefix + key) in raw
    },
    enumerate(obj) {
      console.log('[jsproxy] %s enumerate: %s', name)
      // TODO:
    },
    ownKeys(obj) {
      // console.log('[jsproxy] %s ownKeys', name)
      return getAllKeys()
    },
    defineProperty(obj, key, desc) {
      // console.log('[jsproxy] %s defineProperty: %s', name, key)
      // TODO:
    },
    getOwnPropertyDescriptor(obj, key) {
      // console.log('[jsproxy] %s getOwnPropertyDescriptor: %s', name, key)
      return getOwnPropertyDescriptor(raw, prefix + key)
    }
  })

  defineProperty(win, name, {value: storage})
}


/**
 * @param {WindowOrWorkerGlobalScope} global 
 * @param {string} origin 
 */
export function createStorage(global, origin) {
  //
  // Web Storage
  //
  setup(global, 'localStorage', origin)
  setup(global, 'sessionStorage', origin)

  //
  // Storage API
  //
  function dbOpenHook(oldFn) {
    return function(name) {
      if (name) {
        arguments[0] = prefix + name
      }
      return apply(oldFn, this, arguments)
    }
  }

  // indexedDB
  const idbProto = global.IDBFactory.prototype
  hookFunc(idbProto, 'open', dbOpenHook)

  // Cache Storage
  const cacheStorageProto = global.CacheStorage.prototype
  hookFunc(cacheStorageProto, 'open', dbOpenHook)

  // WebSQL
  hookFunc(global, 'openDatabase', dbOpenHook)
}