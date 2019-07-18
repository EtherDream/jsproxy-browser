JsProxy 浏览器端程序


# 修改配置

修改 `www/conf.js` 配置，发布 `www` 目录即可。


## TODO

* 增加网络错误重试、优先选择空闲节点功能

* 在 SW 中替换 HTML 的 URL 属性，并支持流模式

* CDN 文件使用 brotli 压缩

* 使用 AST 修改 JS 代码

* 动态页面压缩传输（反模板引擎，只传输变量，模板本身存储在 CDN）

* 使用更多的免费图床作为 CDN 资源存储，并支持 Hash 校验

* 计算程序使用 wasm 实现

* 支持 blob/data/javascript 协议

* 增加 qos 功能，优先满足资料查询网站流量

* 改进同源策略的安全性，增加部分 API 的授权界面

* 重新设计首页，增加更多功能

* 完整的测试案例


# 已知问题

* 文件下载对话框取消后 SW 仍在下载（fetch.signal 的 onabort 未触发，可能是浏览器 BUG）

* Chrome 图片无法保存

* 非 UTF8 编码的 JS 会出现乱码（MIME 未指定 charset 的情况下出现）

* Google 登陆页无法下一步

* Google reCAPTCHA 无法执行

* Google Maps 切换到卫星地图后卡死

* iOS Safari 无法播放 Youtube 视频

* twitter 在 Chrome 普通模式下无法登陆，但隐身模式可以

* twitter iframe 经常加载不出来

* SVG 脚本没有处理

* Youtube 视频全屏播放会卡住

* twitch.tv 首页报错（JS 代码修改导致错误，需要在 AST 层面修改）