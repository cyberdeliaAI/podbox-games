#!/bin/sh
# Builds every cart in this folder into dist/<cart>.pbg.
#
#   sh build.sh                  # with the PodBox SDK in ../podbox/arcade/sdk
#   SDK=/path/to/arcade/sdk sh build.sh
#
# A cart is any folder with a cart.json in it.
set -e
here=$(cd "$(dirname "$0")" && pwd)
SDK=${SDK:-$here/../podbox/arcade/sdk}
if [ ! -f "$SDK/pbgc.js" ]; then
    echo "build.sh: no SDK at $SDK -- clone https://github.com/anthonyfletcher/podbox and set SDK" >&2
    exit 1
fi
mkdir -p "$here/dist"
for dir in "$here"/*/; do
    [ -f "$dir/cart.json" ] || continue
    name=$(basename "$dir")
    node "$SDK/pbgc.js" build "$dir" -o "$here/dist/$name.pbg"
done
