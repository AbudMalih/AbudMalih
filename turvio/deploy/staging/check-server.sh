#!/usr/bin/env bash
# READ-ONLY status check of a TURVIO staging server. Changes nothing, prints no secrets.
# Run on the VPS (as root or the deploy user):  bash check-server.sh
# Send the whole output back – it contains no passwords or keys (only "set"/"missing").
set -u
ok() { printf '  [ok]   %s\n' "$*"; }
no() { printf '  [--]   %s\n' "$*"; }
has() { command -v "$1" >/dev/null 2>&1; }
echo "TURVIO server check $(date -u +%FT%TZ)"
echo "== system"
. /etc/os-release 2>/dev/null && ok "OS: ${PRETTY_NAME:-unknown}" || no "OS unknown"
ok "CPU: $(nproc 2>/dev/null) vCPU, RAM: $(free -m 2>/dev/null | awk '/Mem:/{print $2}') MB, swap: $(free -m 2>/dev/null | awk '/Swap:/{print $2}') MB"
ok "disk free on /: $(df -h / 2>/dev/null | awk 'NR==2{print $4}')"
ok "public IPv4: $(curl -s -4 -m 5 https://ifconfig.me 2>/dev/null || echo unknown)"
echo "== users"
id turviodeploy >/dev/null 2>&1 && ok "user turviodeploy exists" || no "user turviodeploy missing (runbook step 1)"
echo "== docker"
if has docker; then ok "docker: $(docker --version 2>/dev/null)"; else no "docker not installed"; fi
if id turviodeploy >/dev/null 2>&1; then
  su - turviodeploy -c 'docker info --format "{{.SecurityOptions}}" 2>/dev/null' 2>/dev/null | grep -q rootless && ok "rootless docker for turviodeploy" || no "rootless docker for turviodeploy not running (step 2)"
fi
echo "== TURVIO files (/opt/turvio)"
[ -d /opt/turvio ] && ok "/opt/turvio exists" || no "/opt/turvio missing (steps 1-4)"
[ -d /opt/turvio/repo/.git ] && ok "repository clone present ($(git -C /opt/turvio/repo log -1 --format=%h 2>/dev/null))" || no "repository clone missing (step 3-4)"
[ -x /opt/turvio/bin/deploy ] && ok "deploy script installed" || no "deploy script missing (step 4)"
[ -f /opt/turvio/supabase-ca.crt ] && ok "Supabase CA present" || no "Supabase CA missing (step 5)"
if [ -f /opt/turvio/.env ]; then
  ok ".env present (mode $(stat -c %a /opt/turvio/.env))"
  for k in TURVIO_API_HOST TURVIO_DISPATCH_HOST TURVIO_ADMIN_HOST ACME_EMAIL SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY DATABASE_URL SMTP_URL MAIL_FROM; do
    v=$(grep -E "^$k=" /opt/turvio/.env | head -1 | cut -d= -f2-)
    if [ -z "$v" ] || echo "$v" | grep -qiE "example|changeme|placeholder|<"; then no "$k not set"; else
      case $k in *HOST|ACME_EMAIL|SUPABASE_URL|MAIL_FROM) ok "$k = $v" ;; *) ok "$k set" ;; esac
    fi
  done
else no ".env missing (step 6)"; fi
[ -f /opt/turvio/state/current ] && ok "deployed release: $(cat /opt/turvio/state/current)" || no "nothing deployed yet"
echo "== network"
for h in $(grep -hE '^TURVIO_(API|DISPATCH|ADMIN)_HOST=' /opt/turvio/.env 2>/dev/null | cut -d= -f2); do
  ip=$(getent hosts "$h" | awk '{print $1}' | head -1); [ -n "$ip" ] && ok "DNS $h -> $ip" || no "DNS $h does not resolve"
done
for p in 80 443; do (ss -ltn 2>/dev/null | grep -q ":$p ") && ok "port $p listening" || no "port $p not listening"; done
has ufw && ok "ufw: $(ufw status 2>/dev/null | head -1)"
curl -s -m 5 -o /dev/null -w '%{http_code}' https://github.com >/dev/null && ok "outbound HTTPS works" || no "no outbound HTTPS"
echo "done"
