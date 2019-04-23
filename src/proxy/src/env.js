import * as conf from './conf.js'

/**
 * @type {Map<Object, {loc: Location, doc: Document, ori: URL, domHook: object}>}
 */
const objInfoMap = new WeakMap()

export function add(win, info) {
  objInfoMap.set(win.Function, info)
}

export function get(obj) {
  const Function = obj.constructor.constructor
  return objInfoMap.get(Function)
}



export const PATH_ROOT = getRootPath() 
export const PATH_HOME = PATH_ROOT + 'index.html'
export const PATH_JS = PATH_ROOT + conf.URL_FILE
export const PATH_PREFIX = PATH_ROOT + conf.URL_DELIM
export const PATH_SYS = PATH_ROOT + 'sys__/'

function getRootPath() {
  //
  // 如果运行在代理页面，当前路径：
  //   https://example.com/path/to/-----url
  // 如果运行在 SW，当前路径：
  //   https://example.com/path/to/x.js
  // 如果运行在 Worker，当前路径：
  //   __PATH__
  // 返回：
  //   https://example.com/path/to/
  //
  const envPath = self.__PATH__
  if (envPath) {
    return envPath
  }
  let url = location.href
  const pos = url.indexOf('/' + conf.URL_DELIM + 'http')
  if (pos === -1) {
    // sw
    url = url.replace(/[^/]+$/, '')
  } else {
    // page
    url = url.substr(0, pos)
  }
  return url.replace(/\/*$/, '/')
}