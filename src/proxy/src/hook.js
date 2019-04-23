const {
  getOwnPropertyDescriptor,
  defineProperty,
  apply,
} = Reflect


export const DROP = {}

/**
 * hook function
 * 
 * @param {object} obj 
 * @param {string} key 
 * @param {(oldFn: Function) => Function} factory
 */
export function func(obj, key, factory) {
  /** @type {Function} */
  const oldFn = obj[key]
  if (!oldFn) {
    return false
  }

  const newFn = factory(oldFn)

  Object.keys(oldFn).forEach(k => {
    newFn[k] = oldFn[k]
  })

  const proto = oldFn.prototype
  if (proto) {
    newFn.prototype = proto
  }

  obj[key] = newFn
  return true
}

/**
 * hook property
 * 
 * @param {object} obj 
 * @param {string} key 
 * @param {(oldFn: () => any) => Function} g 
 * @param {(oldFn: () => void) => Function} s 
 */
export function prop(obj, key, g, s) {
  const desc = getOwnPropertyDescriptor(obj, key)
  if (!desc) {
    return false
  }
  if (g) {
    func(desc, 'get', g)
  }
  if (s) {
    func(desc, 'set', s)
  }
  defineProperty(obj, key, desc)
  return true
}


/**
 * @param {Window} win 
 */
export function createDomHook(win) {
  /**
   * @param {object} proto 
   * @param {string} name 
   * @param {Function} onget 
   * @param {Function} onset 
   */
  function hookElemProp(proto, name, onget, onset) {
    prop(proto, name,
      getter => function() {
        const val = getter.call(this)
        return onget.call(this, val)
      },
      setter => function(val) {
        val = onset.call(this, val)
        if (val === DROP) {
          return
        }
        setter.call(this, val)
      }
    )
  }

  const elemProto = win.Element.prototype
  const rawGetAttr = elemProto.getAttribute
  const rawSetAttr = elemProto.setAttribute

  const tagAttrHandlersMap = {}
  const tagTextHandlerMap = {}
  const tagKeySetMap = {}
  const tagKeyGetMap = {}

  /**
   * @param {string} tag 
   * @param {object} proto 
   * @param  {...any} handlers 
   */
  function attr(tag, proto, ...handlers) {
    /** @type {boolean} */
    let hasBind

    /** @type {boolean} */
    let hasAttr
    
    let keySetMap
    let keyGetMap

    // TODO: 未考虑上下文
  
    handlers.forEach(v => {
      // 带划线的 attr 属性名，转换成驼峰形式的 prop 属性名。
      // 例如 `http-equiv` -> `httpEquiv`
      const prop = v.name.replace(/-(\w)/g,
        (_, char) => char.toUpperCase()
      )
      hookElemProp(proto, prop, v.onget, v.onset)

      // #text
      if (prop === 'innerText') {
        tagTextHandlerMap[tag] = v
        return
      }

      // attribute
      if (tagAttrHandlersMap[tag]) {
        tagAttrHandlersMap[tag].push(v)
        hasBind = true
      } else {
        tagAttrHandlersMap[tag] = [v]
        tagKeySetMap[tag] = {}
        tagKeyGetMap[tag] = {}
      }

      if (!keySetMap) {
        keySetMap = tagKeySetMap[tag]
        keyGetMap = tagKeyGetMap[tag]
      }
      const key = v.name.toLocaleLowerCase()
      keySetMap[key] = v.onset
      keyGetMap[key] = v.onget
      hasAttr = true
    })

    if (hasBind || !hasAttr) {
      return
    }

    // 如果之前调用过 setAttribute，直接返回上次设置的值；
    // 如果没有调用过，则返回 onget 的回调值。
    func(proto, 'getAttribute', oldFn => function(name) {
      const key = (name + '').toLocaleLowerCase()

      const onget = keyGetMap[key]
      if (!onget) {
        return apply(oldFn, this, arguments)
      }

      const lastVal = this['_k' + key]
      if (lastVal !== undefined) {
        return lastVal
      }
      const val = apply(oldFn, this, arguments)
      return onget.call(this, val)
    })

    func(proto, 'setAttribute', oldFn => function(name, val) {
      const key = (name + '').toLocaleLowerCase()
      const onset = keySetMap[key]
      if (onset) {
        this['_k' + key] = val

        const ret = onset.call(this, val)
        if (ret === DROP) {
          return
        }
        arguments[1] = ret
      }
      return apply(oldFn, this, arguments)
    })

    func(proto, 'setAttributeNode', oldFn => function(node) {
      console.warn('setAttributeNode:', node, this)
      // TODO:
      return apply(oldFn, this, arguments)
    })

    // ...
  }

  /**
   * @param {Text} node
   * @param {object} handler
   * @param {Element} elem 
   */
  function parseNewTextNode(node, handler, elem) {
// console.log('parseTextNode')
    const val = node.nodeValue
    const ret = handler.onset.call(elem, val, true)
    if (ret === DROP) {
      return
    }
    node.nodeValue = ret
  }

  /**
   * @param {Element} elem 
   * @param {object} handler
   */
  function parseNewElemNode(elem, handler) {
    const name = handler.name
    if (!elem.hasAttribute(name)) {
      return
    }
    const val = rawGetAttr.call(elem, name)
    const ret = handler.onset.call(elem, val, true)
    if (ret === DROP) {
      return
    }
    rawSetAttr.call(elem, name, ret)
  }

  
  /**
   * @param {Node} node 
   */
  function addNode(node) {
    switch (node.nodeType) {
    case 1:   // ELEMENT_NODE
      const handlers = tagAttrHandlersMap[node.tagName]
      handlers && handlers.forEach(v => {
        parseNewElemNode(node, v)
      })
      break
    case 3:   // TEXT_NODE
      const parent = node.parentElement
      if (parent) {
        const handler = tagTextHandlerMap[parent.tagName]
        if (handler) {
          parseNewTextNode(node, handler, parent)
        }
      }
      break
    }
  }

  /**
   * @param {Node} node 
   */
  function delNode(node) {
    // TODO: 增加节点删除后的回调
  }

  return {
    attr,
    addNode,
    delNode,
  }
}