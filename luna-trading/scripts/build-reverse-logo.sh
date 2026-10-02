#!/bin/bash
# Reverse-colour application of the official Luna Trading wordmark for dark
# surfaces. Pure colour mapping of the master pixels (geometry untouched):
#   red "+" (201,2,22) → unchanged
#   "luna" graphite (107,108,113) → #A6A7AC light metallic grey
#   "trading" black → #F2F2F0
# Anti-aliased mixes are remapped proportionally; alpha is copied unchanged.
set -e
cd "$(dirname "$0")/../public/brand"
SRC=luna-trading-logo-trim.webp
for C in r g b; do
  case $C in r) R=0.788; L=0.651; T=0.949;; g) R=0.008; L=0.655; T=0.949;; b) R=0.086; L=0.675; T=0.941;; esac
  convert $SRC -alpha off -fx "qq=min(1,max(0,(u.r-u.g)/0.78)); vv=min(1,max(0,u.g/(0.423*max(0.05,1-qq)))); qq*$R+(1-qq)*(vv*$L+(1-vv)*$T)" -colorspace Gray /tmp/lt_$C.png
done
convert $SRC -alpha extract /tmp/lt_a.png
convert /tmp/lt_r.png /tmp/lt_g.png /tmp/lt_b.png -set colorspace sRGB -combine /tmp/lt_a.png -compose CopyOpacity -composite -define webp:lossless=true luna-trading-logo-reverse.webp
echo "written public/brand/luna-trading-logo-reverse.webp"
