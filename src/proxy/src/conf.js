export const JS_VER = '22'

export const URL_FILE = 'x.js'
export const URL_DELIM = '-----'
//
// 不走代理的直连资源
//
// 必须满足：
// 1.返回头 access-control-allow-origin 为 *
// 2.不校验 referer，或者允许为空
// 3.不校验 origin
//
// 尽量满足：
// 1.请求 METHOD 为 GET
// 2.请求不产生 preflight
//
export const DIRECT_HOST = [
  // ali
  'at.alicdn.com',
  'img.alicdn.com',
  'g.alicdn.com',
  'i.alicdn.com',
  'atanx.alicdn.com',
  'wwc.alicdn.com',
  'gw.alicdn.com',
  'assets.alicdn.com',
  'aeis.alicdn.com',
  'atanx.alicdn.com',
  'sc01.alicdn.com',
  'sc02.alicdn.com',
  'sc03.alicdn.com',
  'sc04.alicdn.com',

  // baidu
  // 'img*.bdimg.com',
  'img0.bdimg.com',
  'img1.bdimg.com',
  'img2.bdimg.com',
  'img3.bdimg.com',
  'img4.bdimg.com',
  'img5.bdimg.com',
  'webmap0.bdimg.com',
  'webmap1.bdimg.com',
  'iknowpc.bdimg.com',

  // zhihu
  'static.zhihu.com',
  'pic1.zhimg.com',
  'pic2.zhimg.com',
  'pic3.zhimg.com',
  'pic4.zhimg.com',
  'pic5.zhimg.com',
  'pic7.zhimg.com',

  // jianshu
  'upload.jianshu.io',
  'upload-images.jianshu.io',
  'cdn2.jianshu.io',

  // uc
  'image.uc.cn',

  // csdn
  'csdnimg.cn',
  'g.csdnimg.cn',
  'img-ads.csdn.net',

  // ???
  'img-egc.xvideos-cdn.com',
  'img-hw.xvideos-cdn.com',
  'img-l3.xvideos-cdn.com',
  'static-egc.xvideos-cdn.com',
  'cdn77-pic.xvideos-cdn.com',

  // ??
  'ci.phncdn.com',
]

// TODO: 使用更智能的节点选择算法
export const NODE_MAP = {
  'aliyun-hk': 'node-v2-aliyun-hk.etherdream.com:8443',
  'aliyun-sg': 'node-v2-aliyun-sg.etherdream.com:8443',
  'cf-aliyun-hk': 'node-v2-cf-aliyun-hk.etherdream.com:8443',
  'cf-aliyun-sg': 'node-v2-cf-aliyun-sg.etherdream.com:8443',
}

// 默认节点
export const NODE_DEF = 'aliyun-hk'