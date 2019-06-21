export const ENV_PAGE = 1
export const ENV_WORKER = 2
export const ENV_SW = 3

let mEnvType = 0

export function setEnvType(v) {
  mEnvType = v
}

export function isSwEnv() {
  return mEnvType === ENV_SW
}

export function isWorkerEnv() {
  return mEnvType === ENV_WORKER
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