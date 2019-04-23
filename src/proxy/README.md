浏览器脚本 x.js 的源文件

# src

源文件目录

目前存在的大问题：

* 需调整页面静态 HTML 的路径（通过 MutationObserver 效果不好）

* Cookie 没有持久化，以及诸多细节未实现

* 切换线路会导致已有缓存失效

* 不支持 blob/data 协议

* JS 替换 location 等操作过于简单，会有误伤（需要 AST 层面实现）

* JS 包含所有顶级域名后缀列表，导致文件很大（顶级后缀应该使用单独的文件）


# dist

Webpack 打包后的脚本

# debug.sh

开发模式。每次修改自动生成到 www 目录。

# release.sh

发布脚本。
