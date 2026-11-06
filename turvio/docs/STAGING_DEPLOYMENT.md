# TURVIO staging – deployment runbook (Hetzner VPS, rootless Docker)

Status: the repository side is prepared and was rehearsed end to end in a local Docker environment (see section 7). **Nothing has been deployed to the VPS.** Every server step below is done by the owner/admin and requires approval before the first live deployment.

## 1. Architecture

```
Internet ──443/80──► Caddy (TLS, Let's Encrypt) ─┬─► api:4000 ──► Supabase turvio-staging (Postgres via session pooler :5432,
                                                  │                 Auth, Storage) – outbound TLS, CA-verified
                                                  ├─► dispatch:3000 ─┐
                                                  └─► admin:3001 ────┴─► api:4000 (server side)
           internal network (no internet): api ──► optimizer:8000 ──► osrm:5000 (Region Hannover)
```

| Service | Image | Limit | Notes |
|---|---|---|---|
| caddy | `caddy:2.10-alpine` (digest-pinned) | 128 MB | only published service (80, 443 tcp/udp) |
| api | `deploy/docker/api.Dockerfile` – esbuild bundle, node user | 512 MB | `TRUST_PROXY=1`, Supabase keys, SMTP |
| optimizer | `deploy/docker/optimizer.Dockerfile` – uid 10001 | 768 MB, 2 CPU | internal network only |
| osrm | `deploy/docker/osrm.Dockerfile` – OSRM 26.4.1 on Ubuntu 24.04, uid 10002 | 512 MB | data volume `osrm-data`, internal only |
| dispatch / admin | `deploy/docker/web.Dockerfile` – Next.js standalone, node user | 384 / 320 MB | |

All containers have a read-only root filesystem, drop all capabilities (Caddy keeps only `NET_BIND_SERVICE`), use `no-new-privileges`, PID limits and rotated logs. Secrets exist only in `/opt/turvio/.env` (mode 600) and are passed as environment variables to the services that need them; none are baked into images. Database migrations are **not** part of a deployment; they follow [STAGING_MIGRATION_PLAN.md](STAGING_MIGRATION_PLAN.md).

**Memory (4 GB VPS).** The limits add up to about 2.6 GB. Builds run one service at a time, with Next.js capped at 1.5 GB heap. Add 2 GB swap (step 1) so a build next to the running stack cannot exhaust memory. The OSRM preparation for Region Hannover peaks well below 1 GB; its container limit is 1.5 GB.

## 2. Files

| Path | Purpose |
|---|---|
| `deploy/docker/*.Dockerfile` | production images (pinned base-image digests) |
| `deploy/staging/compose.yml` | services, networks, limits, health checks |
| `deploy/staging/Caddyfile` | HTTPS, security headers, SSE streaming, optional Admin IP allowlist |
| `deploy/staging/.env.example` | every variable, no secrets |
| `deploy/staging/deploy.sh` | commit-pinned deploy, health checks, rollback, OSRM refresh |
| `deploy/staging/osrm/prepare.sh` | download + checksum + build of the Hannover graph, atomic switch |
| `deploy/staging/test/local-e2e.sh` | local rehearsal (not for the server) |

## 3. One-time server setup

Commands marked **[admin]** need an account with sudo, i.e. the owner. Commands marked **[turviodeploy]** run as the deploy user without sudo. Steps 1–2 follow Docker's rootless documentation; they were **not executed on Ubuntu 26.04** (see section 8).

### Step 1 [admin] – base system
```bash
sudo apt-get update && sudo apt-get install -y uidmap dbus-user-session slirp4netns docker-ce-rootless-extras git curl
```
```bash
grep turviodeploy /etc/subuid /etc/subgid
```
Both files must show a range, e.g. `turviodeploy:100000:65536`. If they don't:
```bash
sudo usermod --add-subuids 100000-165535 --add-subgids 100000-165535 turviodeploy
```
```bash
sudo loginctl enable-linger turviodeploy
```
Let rootless Docker publish ports 80/443:
```bash
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-turvio-rootless.conf && sudo sysctl --system
```
2 GB swap:
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
AppArmor (Ubuntu 23.10+ restricts unprivileged user namespaces). Allow them only for `rootlesskit`:
```bash
sudo tee /etc/apparmor.d/usr.bin.rootlesskit >/dev/null <<'EOF'
abi <abi/4.0>,
include <tunables/global>
/usr/bin/rootlesskit flags=(unconfined) {
  userns,
  include if exists <local/usr.bin.rootlesskit>
}
EOF
sudo systemctl restart apparmor.service
```
Optional and recommended if nothing else uses it: disable the root Docker daemon so it can't be misused:
```bash
sudo systemctl disable --now docker.service docker.socket
```
Deployment directory:
```bash
sudo install -d -o turviodeploy -g turviodeploy -m 750 /opt/turvio
```
**Hetzner firewall:** allow inbound 80/tcp, 443/tcp and 443/udp from anywhere; keep 22/tcp restricted to your Mac. Outbound must be allowed to GitHub (22 or 443), Supabase (443 and the pooler 5432), Let's Encrypt, Docker Hub / npm / PyPI / Ubuntu & Debian mirrors (builds) and download.bbbike.org (map data).

### Step 2 [turviodeploy] – rootless Docker
```bash
dockerd-rootless-setuptool.sh install
```
Keep client source IPs (needed for the API's per-IP rate limit and the Admin allowlist):
```bash
mkdir -p ~/.config/systemd/user/docker.service.d && printf '[Service]\nEnvironment="DOCKERD_ROOTLESS_ROOTLESSKIT_PORT_DRIVER=slirp4netns"\n' > ~/.config/systemd/user/docker.service.d/override.conf
```
```bash
systemctl --user daemon-reload && systemctl --user enable --now docker
```
```bash
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock && docker info --format '{{join .SecurityOptions " "}}' && docker compose version
```
The output must contain `rootless`. `deploy.sh` refuses to run otherwise.

### Step 3 [turviodeploy] – read-only deploy key
```bash
ssh-keygen -t ed25519 -N "" -C "turvio-staging-deploy (read-only)" -f ~/.ssh/turvio_deploy
```
```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/turvio_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config && chmod 600 ~/.ssh/config
```
Add `~/.ssh/turvio_deploy.pub` in GitHub: repository **AbudMalih/AbudMalih → Settings → Deploy keys → Add deploy key**, title "turvio-staging", **leave "Allow write access" unticked**. The private key never leaves the server.

The key can read the whole repository, including the JARBOU website. `deploy.sh` exports only `turvio/`.

Check GitHub's host key before trusting it:
```bash
ssh-keyscan -t ed25519 github.com 2>/dev/null | ssh-keygen -lf -
```
It must print `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`, as published at docs.github.com. Then:
```bash
ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts
```

### Step 4 [turviodeploy] – clone and install the deploy script
```bash
git clone --branch claude/tender-lovelace-4odw0l --single-branch git@github.com:AbudMalih/AbudMalih.git /opt/turvio/repo
```
```bash
install -d -m 750 /opt/turvio/bin && install -m 750 /opt/turvio/repo/turvio/deploy/staging/deploy.sh /opt/turvio/bin/deploy
```
Re-install the script deliberately when it changes in a reviewed commit. It is not updated automatically.

### Step 5 – Supabase root CA (public certificate)
Supabase Dashboard → Project Settings → Database → **SSL Configuration → Download certificate**. Copy it from your Mac:
```bash
scp prod-ca-2021.crt turviodeploy@<vps>:/opt/turvio/supabase-ca.crt
```
The API verifies the database certificate against it; verification is never disabled.

### Step 6 [turviodeploy] – secrets
```bash
cp /opt/turvio/repo/turvio/deploy/staging/.env.example /opt/turvio/.env && chmod 600 /opt/turvio/.env && nano /opt/turvio/.env
```
Fill in, on the server only:
- **hostnames, `ACME_EMAIL`**;
- **`SUPABASE_PUBLISHABLE_KEY`**;
- **`SUPABASE_SECRET_KEY`**: create a dedicated secret key "turvio-staging-api" in Dashboard → API Keys, so it can be revoked on its own;
- **`DATABASE_URL`**: `turvio_service`, session pooler port 5432, password URL-encoded, no `sslmode`;
- **`SMTP_URL`, `MAIL_FROM`**: an EU SMTP provider. The API refuses to start without SMTP.

### Step 7 – DNS and Supabase URLs
- DNS A (and AAAA) records for the three hostnames → the VPS.
- Supabase Dashboard → Authentication → URL Configuration:
  - Site URL `https://<dispatch host>`;
  - redirect URLs `https://<dispatch host>/reset-password` and `https://<admin host>/reset-password`.

## 4. Deploying (from your Mac)
```bash
ssh turviodeploy@<vps> /opt/turvio/bin/deploy <full 40-character commit SHA>
```
The script:
1. Refuses root, non-rootless Docker, a `.env` with mode ≠ 600 or a different owner, placeholders, a missing CA file, and any SHA that isn't the full 40 characters.
2. Fetches the branch; the commit must be **on `DEPLOY_BRANCH`** (optionally signed: `DEPLOY_REQUIRE_SIGNED=true`).
3. Exports only `turvio/` of that commit to `releases/<sha>/`.
4. Builds the five images one at a time, tagged `:<sha>`. Existing images of the same commit are reused.
5. Prepares the routing graph if it is missing.
6. Starts the stack with `docker compose up --wait`, so every health check must pass.
7. Checks `https://<api>/health`, `https://<dispatch>/login` and `https://<admin>/login` through Caddy on the server itself.
8. On success, records `current`/`previous` and prunes older releases and images. **On failure it restarts the previous release automatically**; on the very first deployment it stops the failed one.

A deployment takes a lock (no parallel runs) and logs to `/opt/turvio/state/deploy.log`.

Other commands:
- `deploy --status`: current and previous release, container state.
- `deploy --rollback`: return to the previous release, using its existing images.
- `deploy --osrm-refresh`: download and rebuild the Region Hannover graph, then restart OSRM. Weekly is enough.

The first deployment takes longer: about 10–20 min building on 2 vCPU, plus a few minutes for the graph.

## 5. After the first deployment
1. **First platform admin** (synthetic test identity):
   - Supabase Dashboard → Authentication → Add user (e-mail + strong password, auto-confirm).
   - Make that user a platform admin: `insert into public.platform_admins (user_id) values ('<uuid>');`. This needs your approval; it is a data change on staging.
2. Sign in to Admin. Two-step verification is required (`REQUIRE_ADMIN_MFA=true`): set up TOTP on the security page.
3. Create the synthetic JARBOU company and invite the pilot users (e-mails go through SMTP).
4. Run the hosted checks (sign-in, TOTP, isolation via the API), then set `EXPO_PUBLIC_API_URL=https://<api host>` in the EAS `preview` environment for the Android test build.

## 6. Operations
- Logs: `docker compose -p turvio-staging logs -f api` (run as turviodeploy). Caddy logs JSON access lines without bodies.
- Certificates live in the `caddy-data` volume; they are renewed automatically.
- Backups: the database is on Supabase (daily backups on paid plans; the Free plan has none, see the migration plan). The VPS holds no business data, only certificates, the routing graph (rebuildable) and `.env`. Keep `.env` in your password manager, not in a server backup.
- Base images are digest-pinned; update them deliberately in a commit (security updates), then deploy that commit.

## 7. What was tested (2026-11-06, local Docker 29.9, rootful, x86-64)
`deploy/staging/test/local-e2e.sh` rehearses the whole flow with throw-away data. Its results are reported in the commit message and the Phase 6 report. Images built: api 342 MB, dispatch 418 MB, admin 417 MB, optimizer 527 MB, osrm 152 MB.

## 8. Not tested
- **Anything on the VPS:**
  - Ubuntu 26.04;
  - the rootless Docker setup, including the AppArmor profile and the `slirp4netns` port driver;
  - the firewall;
  - DNS and Let's Encrypt issuance (only Caddy's internal CA was used);
  - build times and memory on 4 GB / your vCPU count.
- **Hosted Supabase from the containers:**
  - the API connecting as `turvio_service` through the pooler with the Supabase CA;
  - the new `sb_secret_…` key against GoTrue's admin API and Storage. The header format is unit-tested, and the gateway behaviour was checked with the publishable key only.
  - the ES256 verification is unit-tested with a local JWKS; the project's live JWKS serves ES256 keys.
- **SMTP delivery** to a real provider (locally: Mailpit).
- **Real client IPs** behind rootless Docker. Check Caddy's access log before using `ADMIN_ALLOWED_CIDRS`.
