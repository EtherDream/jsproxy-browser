
export const ROOT = getRootPath() 
export const HOME = ROOT + 'index.html'
export const CONF = ROOT + 'conf.js'
export const HELPER = ROOT + 'helper.js'
export const ASSETS = ROOT + 'assets/'
export const PREFIX = ROOT + '-----'


function getRootPath() {
  //
  // 如果运行在代理页面，当前路径：
  //   https://example.com/path/to/-----url
  // 如果运行在 SW，当前路径：
  //   https://example.com/path/to/sw.js
  // 如果运行在 Worker，当前路径：
  //   __PATH__
  // 返回：
  //   https://example.com/path/to/
  //
  const envPath = self['__PATH__']
  if (envPath) {
    return envPath
  }
  let url = location.href
  const pos = url.indexOf('/-----http')
  if (pos === -1) {
    // sw
    url = url.replace(/[^/]+$/, '')
  } else {
    // page
    url = url.substr(0, pos)
  }
  return url.replace(/\/*$/, '/')
}