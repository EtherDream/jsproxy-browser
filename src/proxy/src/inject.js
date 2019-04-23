import * as env from './env.js'
import * as util from "./util";
// import * as jsfilter from './jsfilter.js'



const WORKER_INJECT = util.strToBytes(`\
if (typeof importScripts === 'function' && !self.window) {
  self.__PATH__ = '${env.PATH_ROOT}';
  importScripts('${env.PATH_JS}');
}
`)


export function getWorkerCode() {
  return WORKER_INJECT
}


const PADDING = ' '.repeat(500)

const CSP = `\
'self' \
'unsafe-inline' \
file: \
data: \
blob: \
mediastream: \
filesystem: \
chrome-extension-resource: \
`

/**
 * @param {URL} urlObj 
 * @param {number} pageId 
 */
export function getHtmlCode(urlObj, pageId) {
  const icoUrl = env.PATH_PREFIX + urlObj.origin + '/favicon.ico'

  return util.strToBytes(`\
<!-- JS PROXY HELPER -->
<!doctype html>
<link rel="icon" href="${icoUrl}" type="image/x-icon">
<meta http-equiv="content-security-policy" content="frame-src ${CSP}; object-src ${CSP}">
<base href="${urlObj.href}">
<script data-id="${pageId}" src="${env.PATH_JS}"></script>
<!-- https://github.com/EtherDream/jsproxy -->
<!-- PADDING ${PADDING} -->

`)
}
