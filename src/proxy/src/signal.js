/**
 * Promise 简单封装
 * 
 * 封装前
 * ```
 * function get(...) {
 *   return new Promise(function(resolve, reject) {
 *     ...
 *     function callback(err, result) {
 *       if (err) {
 *         reject(err)
 *       } else {
 *         resolve(result)
 *       }
 *     }
 *     ...
 *   }
 * }
 * ...
 * await get(...)
 * ```
 * 
 * 
 * 封装后
 * ```
 * function get(...) {
 *   ...
 *   const s = new Signal()
 *   function callback(err, result) {
 *     if (err) {
 *       s.abort(err)
 *     } else {
 *       s.notify(result)
 *     }
 *   }
 *   ...
 *   return s.wait()
 * }
 * ...
 * await get(...)
 * ```
 */
export class Signal {
  constructor() {
    this._promise = new Promise((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
    })
  }

  wait() {
    return this._promise
  }

  notify(arg) {
    this._resolve(arg)
  }

  abort(arg) {
    this._reject(arg)
  }
}
