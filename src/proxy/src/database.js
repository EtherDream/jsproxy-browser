import {Signal} from './signal.js'


export class Database {
  /**
   * @param {string} name 
   */
  constructor(name) {
    this._name = name

    /** @type {IDBDatabase} */
    this._db = null
  }

  /**
   * @param {string} table 
   * @param {IDBTransactionMode} mode 
   */
  _getStore(table, mode) {
    return this._db
      .transaction(table, mode)
      .objectStore(table)
  }

  /**
   * @param {Object<string, IDBObjectStoreParameters>} opts 
   */
  open(opts) {
    const s = new Signal()
    const req = indexedDB.open(this._name)

    req.onsuccess = (e) => {
      const idb = req.result
      this._db = idb

      idb.onclose = (e) => {
        console.warn('[jsproxy] indexedDB disconnected, reopen...')
        this.open(opts)
      }
      s.notify()
    }
    req.onerror = (e) => {
      console.warn('req.onerror:', e)
      s.abort(req.error)
    }
    req.onupgradeneeded = (e) => {
      const idb = req.result
      for (const [k, v] of Object.entries(opts)) {
        idb.createObjectStore(k, v)
      }
    }
    return s.wait()
  }


  close() {
    this._db.close()
  }

  /**
   * @param {string} table 
   * @param {any} key 
   */
  get(table, key) {
    const s = new Signal()
    const obj = this._getStore(table, 'readonly')
    const req = obj.get(key)

    req.onsuccess = (e) => {
      s.notify(req.result)
    }
    req.onerror = (e) => {
      s.abort(req.error)
    }
    return s.wait()
  }

  /**
   * @param {string} table 
   * @param {any} record 
   */
  put(table, record) {
    const s = new Signal()
    const obj = this._getStore(table, 'readwrite')
    const req = obj.put(record)

    req.onsuccess = (e) => {
      s.notify()
    }
    req.onerror = (e) => {
      s.abort(req.error)
    }
    return s.wait()
  }

  /**
   * @param {string} table 
   * @param {any} key 
   */
  delete(table, key) {
    const s = new Signal()
    const obj = this._getStore(table, 'readwrite')
    const req = obj.delete(key)

    req.onsuccess = (e) => {
      s.notify()
    }
    req.onerror = (e) => {
      s.abort(req.error)
    }
    return s.wait()
  }

  /**
   * @param {string} table 
   * @param {(any) => boolean} callback 
   */
  enum(table, callback, ...args) {
    const s = new Signal()
    const obj = this._getStore(table, 'readonly')
    const req = obj.openCursor(...args)

    req.onsuccess = (e) => {
      const {result} = req
      if (result) {
        if (callback(result.value) !== false) {
          result.continue()
        }
      } else {
        s.notify()
      }
    }
    req.onerror = (e) => {
      s.abort(req.error)
    }
    return s.wait()
  }
}
