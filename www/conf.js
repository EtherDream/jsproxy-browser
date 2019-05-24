jsproxy_config({
  // 当前配置的版本（服务端记录在日志中，方便排查问题）
  ver: '51',

  // 节点配置
  node_map: {
    'aliyun-hk': {
      label: '轻量云-香港',
      lines: [
        // 多条线路，负载均衡系统会从其中选一条
        'node-aliyun-hk-0.etherdream.com:8443',
        'node-aliyun-hk-1.etherdream.com:8443'
      ]
    },
    'aliyun-sg': {
      label: '轻量云-新加坡',
      lines: [
        'node-aliyun-sg.etherdream.com:8443'
      ]
    },
    'bwh-la': {
      label: '搬瓦工-洛杉矶',
      lines: [
        'node-bwh-la.etherdream.com:8443'
      ]
    },
    'cfworker': {
      label: 'Cloudflare Worker',
      hidden: true,
      lines: [
        // 实验中...
        // 参考 https://github.com/EtherDream/jsproxy/tree/master/cf-worker
        'node-cfworker.etherdream.com:8443'
      ]
    }
  },

  /**
   * 默认节点  
   */
  node_default: 'aliyun-hk',

  /**
   * 加速节点
   */
  node_acc: 'cfworker',

  /**
   * 静态资源 CDN 地址
   * 用于加速 `assets` 目录中的资源访问
   */
  assets_cdn: 'https://cdn.jsdelivr.net/gh/zjcqoo/zjcqoo.github.io@master/assets/',

  // 本地测试时打开，否则访问的是线上的
  // assets_cdn: 'assets/',

  /**
   * 可直连的主机列表（通常为支持 CORS 的 CDN）
   * 
   * 必须满足：
   *  1.返回头 access-control-allow-origin 为 *
   *  2.不校验 referer，或者允许为空
   *  3.不校验 origin
   * 
   * 尽量满足：
   *  1.请求 METHOD 为 GET
   *  2.请求不产生 preflight
   */
  direct_hosts: [
    // js cdn
    'cdn.jsdelivr.net',
    'unpkg.com',

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
    'gss0.baidu.com',

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

    // yd
    'shared.ydstatic.com',

    // ?
    'img.zcool.cn',

    // uc
    'image.uc.cn',

    // csdn
    'csdnimg.cn',
    'g.csdnimg.cn',
    'img-ads.csdn.net',

    // sogou
    'img03.sogoucdn.com',
    'img04.sogoucdn.com',

    // wukong
    'p1.pstatp.com',

    // shimo
    'images-cdn.shimo.im',

    // img host
    's1.momo.moda',

    // 
    'user-gold-cdn.xitu.io',
    'ob7zbqpa6.qnssl.com',

    // ???
    'img-egc.xvideos-cdn.com',
    'img-hw.xvideos-cdn.com',
    'img-l3.xvideos-cdn.com',
    'static-egc.xvideos-cdn.com',
    'cdn77-pic.xvideos-cdn.com',

    // ??
    'ci.phncdn.com',
  ]
})