DST=../../www/assets

rm $DST/bundle.*.js

webpack \
  --o "$DST/bundle.[hash:8].js" \
  --mode production

cd $DST

for i in bundle.*.js; do
  printf "\
jsproxy_config=\
x=>{\
__CONF__=x;\
importScripts(__FILE__=x.assets_cdn+'$i')\
};\
importScripts('conf.js')\
" > ../sw.js
done