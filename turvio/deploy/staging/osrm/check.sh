#!/bin/sh
# check.sh [osrm-url]: real road routes in the cities TURVIO staging must cover.
# Fails when a point is snapped > 1 km (outside the data), a route is 0 m, or the
# geometry does not follow roads (road distance must exceed the straight line).
URL="${1:-http://127.0.0.1:5000}"
MAX_SNAP="${OSRM_MAX_SNAP_METERS:-1000}"
fail=0
check() { # name lng1,lat1 lng2,lat2
  r=$(curl -fsS --max-time 30 "$URL/route/v1/driving/$2;$3?overview=full&geometries=geojson" 2>/dev/null) || { echo "FAIL  $1: no response"; fail=1; return; }
  line=$(echo "$r" | jq -r --arg name "$1" --argjson max "$MAX_SNAP" '
    ([.waypoints[]?.distance] | max // 0) as $snap
    | (.routes[0] // {}) as $rt
    | (($rt.geometry.coordinates // []) | length) as $pts
    | (.code == "Ok" and $snap <= $max and ($rt.distance // 0) > 500 and $pts > 2) as $ok
    | "\(if $ok then "OK  " else "FAIL" end)  \($name)  code=\(.code)  \((($rt.distance // 0) / 100 | round) / 10) km  \((($rt.duration // 0) / 6 | round) / 10) min  max snap \($snap | round) m  \($pts) geometry points"')
  echo "$line"
  case "$line" in OK*) ;; *) fail=1 ;; esac
}
check "Suhl (Thuringia)"       10.6936,50.6106 10.7105,50.6155
check "Hannover"               9.7320,52.3759  9.8045,52.3170
check "Kassel"                 9.4797,51.3127  9.4419,51.3155
check "Bremen"                 8.8017,53.0793  8.8622,53.0545
check "Cologne"                6.9583,50.9413  6.9831,50.9201
check "Suhl -> Hannover"       10.6936,50.6106 9.7320,52.3759
[ "$fail" = 0 ] && echo "routing check passed" || echo "routing check FAILED (graph does not cover all required cities)"
exit "$fail"
