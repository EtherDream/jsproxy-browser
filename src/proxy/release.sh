DST=../../www/assets
CDN=https://cdn.jsdelivr.net/gh/etherdream/jsproxy@gh-pages/assets

rm $DST/bundle.*.js

webpack \
  --o "$DST/bundle.[hash:8].js" \
  --mode production

cd $DST

for i in bundle.*.js ; do
  printf "importScripts(__FILE__='$CDN/$i')" > ../sw.js
done