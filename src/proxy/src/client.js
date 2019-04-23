import * as urlx from './urlx.js'
import * as jsfilter from './jsfilter.js'
import * as inject from './inject.js'
import * as util from './util.js'
import * as network from './network.js'
import * as env from './env.js'
import {createFakeLoc} from './fakeloc.js'
import {createStorage} from './storage.js'
import {lockNative} from './lock-native'
import {
  prop as hookProp,
  func as hookFunc,
} from './hook.js'


const {
  apply,
  construct,
} = Reflect


/**
 * Hook 页面和 Worker 相同的 API
 * 
 * @param {WindowOrWorkerGlobalScope} global
 * @param {string} origin 
 */
export function init(global, origin) {
  // lockNative(win)

  // hook Storage API
  createStorage(global, origin)

  // hook Location API
  const fakeLoc = createFakeLoc(global)

  // hook Performance API
  const perfProto = global.PerformanceEntry.prototype
  hookProp(perfProto, 'name',
    getter => function() {
      const val = getter.call(this)
      if (/^https?:/.test(val)) {
        return urlx.decUrlStrAbs(val)
      }
      return val
    }
  )


  // hook AJAX API
  const xhrProto = global.XMLHttpRequest.prototype
  hookFunc(xhrProto, 'open', oldFn => function(_0, url) {
    if (url) {
      arguments[1] = urlx.encUrlStrRel(url, this)
    }
    return apply(oldFn, this, arguments)
  })

  hookProp(xhrProto, 'responseURL',
    getter => function(oldFn) {
      const val = getter.call(this)
      return urlx.decUrlStrRel(val, this)
    }
  )


  hookFunc(global, 'fetch', oldFn => function(v) {
    if (v) {
      if (v.url) {
        // v is Request
        const newUrl = urlx.encUrlStrAbs(v.url)
        arguments[0] = new Request(newUrl, v)
      } else {
        // v is string
        // TODO: 字符串不传引用，无法获取创建时的 constructor
        arguments[0] = urlx.encUrlStrRel(v, v)
      }
    }
    return apply(oldFn, this, arguments)
  })


  hookFunc(global, 'WebSocket', oldFn => function(url) {
    const urlObj = urlx.newUrl(url)
    if (urlObj) {
      const {ori} = env.get(this)
      if (ori) {
        const args = {
          'origin': ori.origin,
        }
        arguments[0] = network.genWsUrl(urlObj, args)
      }
    }
    return construct(oldFn, arguments)
  })

  /**
   * @param {string} type 
   */
  function hookWorker(type) {
    hookFunc(global, type, oldFn => function(url) {
      if (url) {
        console.log('[jsproxy] new %s: %s', type, url)
        arguments[0] = urlx.encUrlStrRel(url, this)
      }
      return construct(oldFn, arguments)
    })
  }
  
  hookWorker('Worker')
  hookWorker('SharedWorker')


  hookFunc(global, 'importScripts', oldFn => function(...args) {
    const urls = args.map(urlx.encUrlStrRel)
    console.log('[jsproxy] importScripts:', urls)
    return apply(oldFn, this, urls)
  })
}