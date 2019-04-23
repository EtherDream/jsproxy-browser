const {
  getOwnPropertyDescriptor,
  defineProperties,
  freeze,
} = Object


/**
 * @param {object} obj 
 * @param {string[]} keys 
 */
function lock(obj, keys) {
  const map = {}

  keys.forEach(key => {
    const desc = getOwnPropertyDescriptor(obj, key)
    desc.writable = false
    desc.configurable = false
    map[key]= desc
  })
  defineProperties(obj, map)
}


/**
 * @param {Window} win 
 */
export function lockNative(win) {
  // 禁止重写原生属性
  const funcProto = win.Function.prototype
  lock(funcProto, ['call', 'apply'])

  const strProto = win.String.prototype
  lock(strProto, [
    'startsWith',
    'endsWith',
    'split',
    'substr',
    'indexOf',
    'match',
    'toLowerCase',
    // 'trim',
    'replace',
  ])

  const arrProto = win.Array.prototype
  lock(arrProto, [
    'forEach',
    'map',
    'join',
    'push',
    'unshift'
  ])

  const regProto = win.RegExp.prototype
  lock(regProto, ['test'])

  const mapProto = win.Map.prototype
  lock(mapProto, ['get', 'set'])

  const weakmapProto = win.WeakMap.prototype
  lock(weakmapProto, ['get', 'set'])

  const setProto = win.Set.prototype
  lock(setProto, ['has', 'add', 'delete'])

  const weaksetProto = win.WeakSet.prototype
  lock(weaksetProto, ['has', 'add', 'delete'])

  lock(win, ['URL'])
  freeze(win.URL.prototype)
}
