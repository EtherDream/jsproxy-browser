import {
  prop as hookProp,
  func as hookFunc,
} from './hook.js'


const {
  apply,
  construct,
} = Reflect


/**
 * 
 * @param {Window} win 
 */
export function createPermission(win, hook) {
  const navProto = win.Navigator.prototype
  hookProp(navProto, 'cookieEnabled',
    getter => function() {
      // TODO:
      return true
    }
  )


  function mediaHook() {
    return oldFn => function(onOk, onErr) {
      // TODO:
      return apply(oldFn, this, arguments)
    }
  }
  hookFunc(navProto, 'webkitGetUserMedia', mediaHook)
  hookFunc(navProto, 'getUserMedia', mediaHook)


  const MediaDevices = win.MediaDevices
  hookFunc(MediaDevices, 'getUserMedia', oldFn => function(opt) {
    // TODO:
    return apply(oldFn, this, arguments)
  })


  const geoProto = navigator.geolocation.constructor.prototype
  hookFunc(geoProto, 'getCurrentPosition', oldFn => function(opt) {
    // TODO:
    return apply(oldFn, this, arguments)
  })

  hookFunc(geoProto, 'watchPosition', oldFn => function(opt) {
    // TODO:
    return apply(oldFn, this, arguments)
  })
}