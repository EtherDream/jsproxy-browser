for f in *.html; do
  html-minifier \
    --collapse-whitespace \
    --remove-comments \
    --remove-redundant-attributes \
    --remove-script-type-attributes \
    --remove-tag-whitespace \
    --use-short-doctype \
    --remove-attribute-quotes \
    --minify-css true \
    --minify-js '{"toplevel": true, "ie8": true}' \
    -o ../../www/$f \
    $f
done
