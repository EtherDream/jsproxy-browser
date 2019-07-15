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
    return this._db
      .transaction(this._table, mode)
      .objectStore(this._table)
  }


  open(opt) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._name)

      req.onsuccess = () => {
        this._db = req.result
        resolve()
      }
      req.onerror = () => {
        reject(req.error)
      }
      req.onupgradeneeded = () => {
        const idb = req.result
        const obj = idb.createObjectStore(this._table, opt)
        const t = obj.transaction
        t.oncomplete = () => {
          this._db = idb
          resolve()
        }
        t.onerror = () => {
          reject(t.error)
        }
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

      req.onsuccess = () => {
        resolve(req.result)
      }
      req.onerror = () => {
        reject(req.error)
      }
    })
  }


  put(record) {
    return new Promise((resolve, reject) => {
      const obj = this._getStore('readwrite')
      const req = obj.put(record)

      req.onsuccess = () => {
        resolve()
      }
      req.onerror = () => {
        reject(req.error)
      }
    })
  }


  delete(key) {
    return new Promise((resolve, reject) => {
      const obj = this._getStore('readwrite')
      const req = obj.delete(key)

      req.onsuccess = () => {
        resolve()
      }
      req.onerror = () => {
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

      req.onsuccess = () => {
        const {result} = req
        if (result) {
          if (callback(result.value) !== false) {
            result.continue()
          }
        } else {
          resolve()
        }
      }
      req.onerror = () => {
        reject(req.error)
      }
    })
  }
}
