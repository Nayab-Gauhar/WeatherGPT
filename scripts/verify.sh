#!/usr/bin/env bash
#
# Visual + functional verification pass.
#
# Drives the running app through one query per intent and captures a screenshot
# of each, so regressions in either the data path or the layout are visible.
set -uo pipefail
cd "$(dirname "$0")/.."

SHOTS=/projects/sandbox/.kiro/artifacts/screenshots
SESSION="${SESSION:-verify}"
URL=http://127.0.0.1:5173/
mkdir -p "$SHOTS"

ab() { agent-browser --session "$SESSION" "$@"; }

# Read the *last* element matching a selector — the transcript accumulates, so
# the first match is an earlier answer, not the one just produced.
# Wrapped in an IIFE: the browser reuses one eval context across invocations,
# so a bare `const` would collide on the second call.
dump() { # dump <selector> <chars>
  ab eval "(() => { const el = [...document.querySelectorAll('$1')].pop(); return el ? el.innerText.replace(/\n+/g, ' | ').slice(0, ${2:-300}) : 'NOT FOUND: $1'; })()" 2>&1 | tail -2
}

ask() { # ask <text> <label> <settle-seconds>
  ab fill ".composer__input" "$1" > /dev/null 2>&1
  ab click ".composer__send" > /dev/null 2>&1
  sleep "${3:-8}"
  ab eval "const el=document.querySelector('.chat__scroll'); el.scrollTop=el.scrollHeight; 1" > /dev/null 2>&1
  ab screenshot "$SHOTS/$2.png" 2>&1 | tail -1
}

echo "== opening =="
ab open "$URL" 2>&1 | tail -1
sleep 14

echo "== 1. boot: current weather =="
ab eval "const b=[...document.querySelectorAll('.msg--user')].pop(); b&&b.scrollIntoView({block:'start'}); 1" > /dev/null 2>&1
sleep 1
ab screenshot "$SHOTS/v1-current.png" 2>&1 | tail -1
dump ".card--current" 400

echo "== 2. 7-day forecast (chip) =="
ab eval "[...document.querySelectorAll('.chip')].find(c=>/7-day|forecast/i.test(c.textContent))?.click(); 1" > /dev/null 2>&1
sleep 8
ab eval "const el=document.querySelector('.chat__scroll'); el.scrollTop=el.scrollHeight; 1" > /dev/null 2>&1
ab screenshot "$SHOTS/v2-forecast.png" 2>&1 | tail -1
dump ".card--daily" 300

echo "== 3. air quality =="
ask "air quality in Delhi" "v3-aqi" 8
dump ".card--aqi" 260

echo "== 4. warnings =="
ask "any cyclone or flood warnings for Puri" "v4-alerts" 8
dump ".card--alerts, .card--clear" 320

echo "== 5. farmer advisory =="
ask "crop advisory for farmers in Nagpur" "v5-agri" 8
dump ".card--sector" 340

echo "== 6. aviation briefing =="
ask "aviation weather briefing for Mumbai airport" "v6-aviation" 8
dump ".card--sector" 340

echo "== 6b. marine advisory =="
ask "is it safe for fishing near Puri today" "v6b-marine" 8
dump ".card--sector" 340

echo "== 7. climate trend =="
ask "climate trend for Shimla over the last years" "v7-climate" 10
dump ".card--climate" 300

echo "== 8. NWP model comparison =="
ask "compare GFS and ECMWF forecast models for Chennai" "v8-models" 10
dump ".card--models" 360

echo "== 9. Hindi query =="
ask "कोलकाता में कल बारिश होगी क्या?" "v9-hindi" 8
ab eval "[...document.querySelectorAll('.msg--bot .msg__text')].pop()?.innerText ?? 'NO REPLY'" 2>&1 | tail -2

echo "== 10. Bengali query =="
ask "কলকাতায় আবহাওয়া কেমন?" "v10-bengali" 8
ab eval "[...document.querySelectorAll('.msg--bot .msg__text')].pop()?.innerText ?? 'NO REPLY'" 2>&1 | tail -2

echo "== 11. 2D projection =="
ab eval "[...document.querySelectorAll('.globe__mode')].find(b=>b.textContent.trim().startsWith('2'))?.click(); 1" > /dev/null 2>&1
sleep 3
ab screenshot "$SHOTS/v11-map2d.png" 2>&1 | tail -1

echo "== 12. dark theme =="
ab eval "[...document.querySelectorAll('.globe__mode')].find(b=>b.textContent.trim().startsWith('3'))?.click(); 1" > /dev/null 2>&1
sleep 2
ab eval "document.querySelectorAll('.appbar__actions .icon-btn')[0].click(); 1" > /dev/null 2>&1
sleep 5
ab screenshot "$SHOTS/v12-dark.png" 2>&1 | tail -1
ab eval "document.documentElement.dataset.theme" 2>&1 | tail -1

echo "== 13. settings / language panel =="
ab eval "document.documentElement.dataset.theme='light'; document.querySelectorAll('.appbar__actions .icon-btn')[1].click(); 1" > /dev/null 2>&1
sleep 2
ab screenshot "$SHOTS/v13-settings.png" 2>&1 | tail -1

echo "== console errors =="
ab eval "JSON.stringify((window.__consoleErrors||[]).slice(0,10))" 2>&1 | tail -2

echo "== done =="
