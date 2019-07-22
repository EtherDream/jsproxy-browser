import * as hook from './hook.js'
import * as urlx from './urlx.js'


const {
  apply,
  defineProperty,
  ownKeys,
  getOwnPropertyDescriptor,
} = Reflect

const undefined = void 0


/**
 * @param {WindowOrWorkerGlobalScope} win 
 * @param {string} name 
 * @param {string} prefix 
 */
function setup(win, name, prefix) {
  /** @type {Storage} */
  const raw = win[name]
  if (!raw) {
    return
  }
  const prefixLen = prefix.length

  const nativeMap = {
    getItem,
    setItem,
    removeItem,
    clear,
    key,
    constructor: raw.constructor,
    toString: () => raw.toString(),
    [Symbol.toStringTag]: 'Storage',
    get length() {
      return getAllKeys().length
    },
  }
  
  /**
   * @param {*} key 
   */
  function getItem(key) {
    return raw.getItem(prefix + key)
  }

  /**
   * @param {*} key 
   * @param {string} val 
   */
  function setItem(key, val) {
    // TODO: 同步到 indexedDB
    raw.setItem(prefix + key, val)
  }

  /**
   * @param {*} key 
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
    const ret = []
    const keys = ownKeys(raw)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (typeof key !== 'string') {
        continue
      }
      if (!key.startsWith(prefix)) {
        continue
      }
      ret.push(key.substr(prefixLen))
    }
    return ret
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
      removeItem(key)
      return true
    },
    has(obj, key) {
      console.log('[jsproxy] %s has: %s', name, key)
      if (typeof key === 'string') {
        return (prefix + key) in obj
      }
      return false
    },
    // enumerate(obj) {
    //   console.log('[jsproxy] %s enumerate: %s', name)
    //   // TODO:
    // },
    ownKeys(obj) {
      // console.log('[jsproxy] %s ownKeys', name)
      return getAllKeys()
    },
    // defineProperty(obj, key, desc) {
    //   // console.log('[jsproxy] %s defineProperty: %s', name, key)
    //   // TODO:
    // },
    getOwnPropertyDescriptor(obj, key) {
      // console.log('[jsproxy] %s getOwnPropertyDescriptor: %s', name, key)
      if (typeof key === 'string') {
        return getOwnPropertyDescriptor(raw, prefix + key)
      }
    }
  })

  defineProperty(win, name, {value: storage})
}


/**
 * @param {WindowOrWorkerGlobalScope} global 
 * @param {string} origin 
 */
export function createStorage(global, origin) {
  const prefixStr = origin + '$'
  const prefixLen = prefixStr.length


  function delPrefix(str) {
    return str.substr(prefixLen)
  }

  function delPrefixGetter(oldFn) {
    return function() {
      const val = oldFn.call(this)
      return val && delPrefix(val)
    }
  }

  //
  // Web Storage
  //
  setup(global, 'localStorage', prefixStr)
  setup(global, 'sessionStorage', prefixStr)

  const StorageEventProto = global['StorageEvent'].prototype

  hook.prop(StorageEventProto, 'key', delPrefixGetter)
  hook.prop(StorageEventProto, 'url',
    getter => function() {
      const val = getter.call(this)
      return urlx.decUrlStrAbs(val)
    }
  )
  // TODO: StorageEventProto.storageArea

  //
  // Storage API
  //
  function addPrefixHook(oldFn) {
    return function(name) {
      if (arguments.length > 0) {
        arguments[0] = prefixStr + name
      }
      return apply(oldFn, this, arguments)
    }
  }

  // indexedDB
  const IDBFactoryProto = global['IDBFactory'].prototype
  hook.func(IDBFactoryProto, 'open', addPrefixHook)

  hook.func(IDBFactoryProto, 'databases', oldFn => async function() {
    /** @type { {name: string, version: number}[] } */
    const arr = await apply(oldFn, this, arguments)
    const ret = []
    for (const v of arr) {
      if (v.name[0] !== '.') {
        v.name = delPrefix(v.name)
        ret.push(v)
      }
    }
    return ret
  })

  // delete
  hook.func(IDBFactoryProto, 'deleteDatabase', addPrefixHook)

  const IDBDatabaseProto = global['IDBDatabase'].prototype
  hook.prop(IDBDatabaseProto, 'name', delPrefixGetter)


  // Cache Storage
  const cacheStorageProto = global['CacheStorage'].prototype
  hook.func(cacheStorageProto, 'open', addPrefixHook)

  hook.func(cacheStorageProto, 'keys', oldFn => async function() {
    /** @type {string[]} */
    const arr = await apply(oldFn, this, arguments)
    const ret = []
    for (const v of arr) {
      if (v[0] !== '.') {
        ret.push(delPrefix(v))
      }
    }
    return ret
  })

  hook.func(cacheStorageProto, 'delete', addPrefixHook)

  // WebSQL
  hook.func(global, 'openDatabase', addPrefixHook)
}