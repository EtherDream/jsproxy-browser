ofile=$(mktemp)
curl https://publicsuffix.org/list/effective_tld_names.dat > $ofile

node gen.js $ofile > ../src/tld-data.js

echo "done"