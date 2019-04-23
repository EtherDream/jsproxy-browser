JsProxy 浏览器端程序

目前还比较简陋，完善中。。。


# 如何修改线路地址

修改 `proxy/src/conf.js` 中 `NODE_MAP` 和 `NODE_DEF` 变量，执行 `proxy/debug.sh` 更新。

修改 `home/index.html` 中的 `selNode` 元素，执行 `home/build.sh` 更新。

之后会做成动态配置的方式，硬编码很麻烦~