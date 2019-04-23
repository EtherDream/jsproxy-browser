## index.html 

功能：首页

演示：https://zjcqoo.github.io/


## 404.html

功能：安装 Service Worker

如果用户直接访问某个目标页面，例如 https://zjcqoo.github.io/-----https://www.google.com ，由于该路径并不存在，因此会显示 404 页面。

通过 404 页面安装 SW 然后自动刷新，后续请求即可被 SW 代理到我们的服务器，无需再访问 github 服务器。


## build.sh

功能：压缩当前目录的 *.html 到 ../../www 目录
