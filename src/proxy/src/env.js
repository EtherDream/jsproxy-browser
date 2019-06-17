export const ENV_PAGE = 1
export const ENV_WORKER = 2
export const ENV_SW = 3

let envType = 0

export function setEnvType(v) {
  envType = v
}

export function isEnvSw() {
  return envType === ENV_SW
}

export function isEnvWorker() {
  return envType === ENV_WORKER
}


/**
 * @type {WeakMap<Object, {loc: Location, doc: Document, ori: URL, domHook: object}>}
 */
const objInfoMap = new WeakMap()

export function add(win, info) {
  objInfoMap.set(win.Function, info)
}

export function get(obj) {
  const Function = obj.constructor.constructor
  return objInfoMap.get(Function)
}