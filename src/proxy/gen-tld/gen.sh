curl -o ./.list.dat https://publicsuffix.org/list/effective_tld_names.dat

node gen.js > ../src/tld-data.js

echo "done"