export class Database {
  /**
   * @param {string} name 
   * @param {string} table 
   */
  constructor(name, table) {
    this._name = name
    this._table = table

    /** @type {IDBDatabase} */
    this._db = null
  }


  /**
   * @param {IDBTransactionMode} mode 
   */
  _getStore(mode) {
    let t = this._db.transaction(this._table, mode)
    return t.objectStore(this._table)
  }


  open(opt) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._name)

      req.onsuccess = (e) => {
        const idb = req.result
        this._db = idb

        idb.onclose = (e) => {
          console.warn('[jsproxy] indexedDB disconnected, reopen...')
          this.open(opt)
        }
        resolve()
      }
      req.onerror = (e) => {
        console.warn('req.onerror:', e)
        reject(req.error)
      }
      req.onupgradeneeded = (e) => {
        const idb = req.result
        idb.createObjectStore(this._table, opt)
      }
    })
  }


  close() {
    this._db.close()
  }


  query(key) {
    return new Promise((resolve, reject) => {
      const obj = this._getStore('readonly')
      const req = obj.get(key)

      req.onsuccess = (e) => {
        resolve(req.result)
      }
      req.onerror = (e) => {
        reject(req.error)
      }
    })
  }


  put(record) {
    return new Promise((resolve, reject) => {
      const obj = this._getStore('readwrite')
      const req = obj.put(record)

      req.onsuccess = (e) => {
        resolve()
      }
      req.onerror = (e) => {
        reject(req.error)
      }
    })
  }


  delete(key) {
    return new Promise((resolve, reject) => {
      const obj = this._getStore('readwrite')
      const req = obj.delete(key)

      req.onsuccess = (e) => {
        resolve()
      }
      req.onerror = (e) => {
        reject(req.error)
      }
    })
  }


  /**
   * @param {(any) => boolean} callback 
   */
  enum(callback, ...args) {
    return new Promise((resolve, reject) => {
      const obj = this._getStore('readonly')
      const req = obj.openCursor(...args)

      req.onsuccess = (e) => {
        const {result} = req
        if (result) {
          if (callback(result.value) !== false) {
            result.continue()
          }
        } else {
          resolve()
        }
      }
      req.onerror = (e) => {
        reject(req.error)
      }
    })
  }
}
