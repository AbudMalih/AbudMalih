# JARBOU Recruiting Command Center – Installation on the UGREEN NAS

**Version 2.0 NAS · JARBOU Logistik GmbH · Internal use only**

This guide explains, step by step, how to install the recruiting system on the JARBOU UGREEN NAS
(UGOS Pro with the Docker app) so that all authorised colleagues – in Hannover, Köln, Kassel or
working remotely – work with **one central database**.

No programming knowledge is needed. Plan about 45 minutes for the first installation.

```
Employee browser (office or remote via Tailscale)
        │  http://<NAS>:8080   or   https://jarbou-recruiting.<tailnet>.ts.net
        ▼
UGREEN NAS ─ Docker ─┬─ app  (web application + API, port 8080)
                     └─ db   (PostgreSQL 16 – NOT reachable from outside)
                            ↓
        NAS folders:  data/postgres · data/uploads · backups
```

> **Where is my data?** Everything important is stored in three folders next to the
> `docker-compose.yml` file on the NAS:
> `data/postgres` (database), `data/uploads` (candidate documents), `backups` (backup files).
> Restarting the containers, Docker or the NAS does **not** delete them.
> **Never delete these folders** – not even when updating the application.

---

## Contents
1. Copy the files to the NAS · 2. Open Docker in UGOS Pro · 3. Create the Docker Compose project ·
4. Configure `.env` · 5. Start the containers · 6. Check that everything is healthy · 7. Find the NAS IP ·
8. Open the application · 9. First sign-in as administrator · 10. Create employee accounts ·
11. Configure the project · 12. Configure stations · 13. Set driver targets · 14. Backups ·
15. Remote access – overview · 16. Tailscale (remote offices) · 17. Test a colleague's access ·
18. Test a backup · 19. Test a restore · 20. Update the application safely ·
Remote access from another office · Offboarding an employee · Moving old offline data · Troubleshooting

---

## 1. Copy the files to the NAS

1. Unpack the delivered `jarbou-recruiting` folder on your computer.
2. In UGOS Pro, open **Files** and create a shared folder for Docker projects if you do not have one,
   e.g. `docker`.
3. Upload the whole `jarbou-recruiting` folder into it, so that you get for example
   `/docker/jarbou-recruiting/docker-compose.yml`.
   (Alternatively copy it via the network share from Windows Explorer / macOS Finder.)

The folder contains, among others:

| File / folder | Purpose |
|---|---|
| `docker-compose.yml` | describes the two containers (app + database) |
| `.env.example` | configuration template – you create `.env` from it |
| `Dockerfile`, `backend/`, `frontend/`, `database/` | the application |
| `docker-compose.tailscale.yml` | optional private HTTPS access through Tailscale |
| `README-UGREEN.md` | this guide |

## 2. Open Docker in UGOS Pro

1. Sign in to UGOS Pro as NAS administrator.
2. Open the **App Center** and install **Docker** if it is not installed yet.
3. Open the **Docker** app.

## 3. Create the Docker Compose project

1. In the Docker app go to **Project** (sometimes shown as "Compose").
2. Click **Create**.
3. Project name: `jarbou-recruiting`.
4. Storage path / project folder: choose the uploaded folder `/docker/jarbou-recruiting`.
5. UGOS detects the existing `docker-compose.yml`. Use it as it is (do not paste a different file).
6. **Do not start yet** – first create the `.env` file (step 4). If UGOS starts the project
   automatically and it fails because `POSTGRES_PASSWORD` is missing, that is expected: just continue with step 4.

> If your UGOS version has no project function, you can use SSH instead (see *Command line* at the end).

## 4. Configure `.env`

1. In **Files**, open the folder `jarbou-recruiting`.
2. Copy `.env.example` and name the copy exactly `.env` (with the dot, no `.txt`).
   *(Tip: in Windows Explorer enable "file name extensions" to see the real name.)*
3. Open `.env` with the UGOS text editor and change these lines:

| Setting | What to enter |
|---|---|
| `POSTGRES_PASSWORD` | a long random password (at least 20 characters). Only the app uses it; nobody types it. |
| `APP_SECRET` | another long random value (at least 32 characters). |
| `INITIAL_ADMIN_USERNAME` | e.g. `abud` (lower-case letters, numbers, `.`, `-`, `_`) |
| `INITIAL_ADMIN_FULL_NAME` | e.g. `Abud Malih` |
| `INITIAL_ADMIN_PASSWORD` | a temporary password, min. 10 characters with letters **and** numbers, **must not contain the username**. You must change it at the first sign-in. |
| `APP_PORT` | keep `8080` unless that port is already used on the NAS |
| `TZ` | keep `Europe/Berlin` |
| `BACKUP_TIME` | time of the daily automatic backup, e.g. `02:30` |

Save the file. **Keep `.env` private** – it contains passwords. Do not e-mail it.

> Random values: a password manager can generate them, or on any computer with a terminal:
> `openssl rand -base64 32`.

## 5. Start the containers

In the Docker app → **Project** → `jarbou-recruiting` → **Start / Build**.

The first start **builds** the application image; this needs internet access and takes
2–5 minutes. Later starts take a few seconds.

## 6. Check that everything is healthy

In the Docker app → **Container**, you should see two containers:

| Container | Status |
|---|---|
| `jarbou-recruiting-db-1` | running · **healthy** |
| `jarbou-recruiting-app-1` | running · **healthy** (after up to 60 seconds) |

You can also open `http://<NAS-IP>:8080/api/health` – it must show
`{"status":"ok","database":"ok","version":"2.0.0"}`.

Both containers are configured with `restart: unless-stopped`: after a NAS reboot they start again
automatically, and the application is available again after about one minute.

If a container is not healthy, open its **Log** (see *Troubleshooting*).

## 7. Find the NAS IP address

UGOS Pro → **Control Panel → Network** (or the UGREEN app) shows the local IP address, e.g. `192.168.1.50`.
Ask your IT provider to give the NAS a **fixed IP address** (DHCP reservation in the router), so the
address does not change.

## 8. Open the application

In Chrome, Edge, Firefox or Safari open:

```
http://<NAS-IP>:8080        e.g. http://192.168.1.50:8080
```

Create a bookmark for all colleagues. The sign-in page shows the JARBOU logo,
*Recruiting Command Center* and *DHL Express Project*.

## 9. First sign-in as administrator

1. Sign in with `INITIAL_ADMIN_USERNAME` and `INITIAL_ADMIN_PASSWORD` from `.env`.
2. You are asked to set a **new personal password** immediately.
3. Afterwards **remove the value of `INITIAL_ADMIN_PASSWORD` from `.env`** (leave the line empty).
   It is only used when the database contains no user at all.

The two existing candidates (Riber Isso, Abdalrazaq Al Shaer) are already in the database.

## 10. Create employee accounts

**Settings → Users → Create user.** Fill in full name, username, e-mail (optional), role and a
temporary password. Tell the colleague the temporary password in person or by phone; they must
change it at the first sign-in.

| Role | Can do |
|---|---|
| **Admin** | everything: candidates, settings, users, targets, backups, restore, audit log, permanent deletion |
| **Recruiter** | view/create/edit candidates, documents, file uploads, contracts, onboarding, notes, follow-ups, pipeline, archive/restore, reports, exports |
| **Viewer** | read-only: dashboard, candidates, reports – cannot change anything |

There is no self-registration. Only administrators create accounts. Permissions are checked by the
server for every action, not only hidden in the interface.

## 11. Configure the project

**Settings → Projects.** "DHL Express" already exists. Add future projects here; inactive projects
can be deactivated instead of deleted. The project selector in the top bar filters all pages.

## 12. Configure stations

**Settings → Stations.** Hannover, Kassel, Haiger and Bremen exist. Add, rename (all candidates
update automatically), reorder or deactivate stations. Positions and recruitment sources are
managed the same way.

## 13. Set driver targets

**Settings → Recruitment Targets.** Add one row per target, for example:

| Project | Station | Required drivers |
|---|---|---|
| DHL Express | All stations | 30 |
| DHL Express | Hannover | 12 |

The dashboard then shows, per target: Required · Candidates · Administratively ready · Started ·
Remaining, with a progress bar. "Administratively ready" means documents, contract and required
information are complete – a candidate who *says* he is ready is not automatically counted.

## 14. Backups

The application makes a **daily automatic backup** at `BACKUP_TIME` into the NAS folder
`jarbou-recruiting/backups`. Each backup is a single file
`jarbou-recruiting_YYYY-MM-DD_HHMMSS_<type>.tar.gz` containing the complete database **and** all
uploaded documents.

Retention (automatic backups): the last **7 daily**, **4 weekly** and **3 monthly** backups are kept
(`BACKUP_KEEP_DAILY / _WEEKLY / _MONTHLY` in `.env`). Manual and pre-restore backups are never
deleted automatically.

**Settings → Backups** shows *Last successful backup*, *Backup status* and *Next scheduled backup*,
and has the button **Create backup now**. Admins see a warning on the dashboard if the last backup
failed or is older than 36 hours.

**Important – a backup on the same NAS is not enough.** Copy the `backups` folder regularly to a
second location, e.g. with the UGREEN backup app to a USB disk or a second NAS, or to an encrypted
cloud storage that JARBOU controls. The backup files contain personal data – store them protected.

## 15. Remote access – overview

Colleagues in the office network use `http://<NAS-IP>:8080`.

For other offices and remote work, use a **private network (Tailscale)** – see the next section.

**Do not** open port 8080 or 5432 on the router ("port forwarding"). The application must never be
reachable from the public internet, and the database port is not published at all – it is only
reachable by the app container inside Docker.

## 16. Tailscale (remote offices)

Tailscale creates a private, encrypted network between the NAS and the approved laptops of
JARBOU employees. Only devices you approve can reach the NAS.

**Two layers of protection:** (1) the device must be in the JARBOU Tailscale network, **and**
(2) the person must sign in to the application with their own account. Tailscale access alone is
not enough to see any data.

### 16.1 Create the JARBOU Tailscale network (once)
1. Go to <https://tailscale.com> and sign up with a **company** account (e.g. Microsoft 365 / Google
   Workspace of JARBOU). This account becomes the network owner.
2. In the admin console → **Settings → Device approval**, enable **manual device approval**.
3. Optional but recommended: **DNS → enable MagicDNS** and **HTTPS certificates** (needed for option B).

### 16.2 Connect the NAS – choose ONE option

**Option A – Tailscale app on the NAS (simplest, if available in your UGOS App Center)**
1. UGOS Pro → App Center → search *Tailscale* → install and open it.
2. Sign in with the JARBOU Tailscale account and approve the NAS in the admin console.
3. The admin console shows the NAS's Tailscale address, e.g. `100.101.102.103`, and name, e.g. `ugreen-nas`.
4. Colleagues then open `http://100.101.102.103:8080` (or `http://ugreen-nas:8080` with MagicDNS).

**Option B – Tailscale container with private HTTPS (recommended for daily remote work)**
1. In the Tailscale admin console → **Settings → Keys → Generate auth key** (not reusable,
   pre-approved, optionally with an expiry). Copy the key.
2. In `.env` set `TS_AUTHKEY=tskey-auth-…` and also `COOKIE_SECURE=true` and `TRUST_PROXY=true`.
3. Start the project with the additional file `docker-compose.tailscale.yml`
   (in UGOS: add it to the project, or via SSH:
   `docker compose -f docker-compose.yml -f docker-compose.tailscale.yml up -d`).
4. After a minute the device `jarbou-recruiting` appears in the admin console. Colleagues open
   `https://jarbou-recruiting.<your-tailnet>.ts.net` – with a valid HTTPS certificate, nothing
   exposed to the internet.
5. With `COOKIE_SECURE=true` sign-in works **only via the https address**. Office colleagues then
   also use the `https://…ts.net` address (with Tailscale installed) – or keep `COOKIE_SECURE=auto`
   if the office should continue using `http://<NAS-IP>:8080`.

### 16.3 Connect an employee laptop (Windows / Mac)
1. Install Tailscale from <https://tailscale.com/download> (Windows) or the Mac App Store.
2. Open Tailscale → **Log in** with the JARBOU company account of the employee
   (or accept the invitation the admin sent from the admin console → **Users → Invite**).
3. The administrator approves the new device in the admin console (**Machines → Approve**).
4. The employee opens the private address (step 16.2) and signs in with the application account.

### 16.4 Restrict access (recommended)
In the Tailscale admin console → **Access controls**, allow employee devices to reach only the NAS
on port 8080 / 443 (and nothing else). Your IT provider can set this up in a few minutes.

## 17. Test a colleague's access
1. Create a test user with role *Viewer* (step 10).
2. On another computer (in the office, and once via Tailscale from outside): open the address,
   sign in, change the password, check that the dashboard shows the same numbers as yours.
3. As admin, change a document status of a candidate – the colleague sees it within seconds
   (live update; at the latest after the refresh button ⟳ in the top bar).
4. Deactivate the test user afterwards.

## 18. Test a backup
1. Settings → Backups → **Create backup now** → a new file appears in the list with status *success*.
2. In UGOS Files check that the file exists in `jarbou-recruiting/backups`.
3. Download it once via **Download** and store it in the second backup location.

## 19. Test a restore (do this once before going live)
1. Create a test candidate "Restore Test".
2. Create a backup.
3. Delete or change the test candidate.
4. Settings → Backups → choose the backup → **Restore** → read the warning
   *"WARNING: Restoring this backup will replace the current recruitment database."* → type `RESTORE`.
5. A **safety backup** of the current state is created automatically first; then the database and
   documents are replaced. **All users are signed out** and sign in again.
6. Check that "Restore Test" is back in its original state. The restore is recorded in the audit log.

### Emergency restore via the command line (if the web interface is not reachable)
Via SSH on the NAS (`Control Panel → Terminal → enable SSH`, then connect with an SSH client):
```bash
cd /volume1/docker/jarbou-recruiting          # your project folder
docker compose exec app node src/cli.js list-backups
docker compose exec app node src/cli.js restore jarbou-recruiting_2026-10-01_023000_auto.tar.gz
```
If the app container does not start at all, only the database can be restored manually:
```bash
tar -xzf backups/<file>.tar.gz -C /tmp database.sql
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 --single-transaction -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -f -' < /tmp/database.sql
```

Other helpful commands:
```bash
docker compose exec app node src/cli.js reset-password <username>     # forgotten admin password
docker compose exec app node src/cli.js create-admin <username> "Full Name"
docker compose exec app node src/cli.js backup                         # backup now
docker compose logs --tail 100 app                                     # application log
```

## 20. Update the application safely

Your data lives in `data/` and `backups/`, **not** in the containers. An update never needs these
folders to be deleted.

1. **BACKUP** – Settings → Backups → *Create backup now* (or `docker compose exec app node src/cli.js backup pre-update`).
   Copy the backup file to a second location.
2. **STOP APP** – Docker → Project → `jarbou-recruiting` → Stop.
3. **UPDATE CODE** – replace the application files in the project folder with the new version:
   `backend/`, `frontend/`, `database/`, `Dockerfile`, `docker-compose*.yml`, `VERSION`, README files.
   **Do not replace or delete** `.env`, `data/` or `backups/`.
4. **BUILD + START** – Project → Build/Start (rebuilds the image). Database **migrations run
   automatically** at start; they only add changes and never delete candidate data.
5. **VERIFY** – both containers healthy, `/api/health` OK, sign in, open a few candidates,
   check Settings → Data & Privacy shows the new version.
6. **ROLLBACK IF REQUIRED** – stop the project, put the previous application files back, start again.
   If the new version had already changed the database and the old version does not start,
   restore the backup from step 1 (section 19).

---

## Remote access from another office – short guide for employees

1. Install **Tailscale** on your work laptop and sign in with your JARBOU account.
2. Wait until the administrator has approved your device.
3. Open the bookmark `https://jarbou-recruiting.<tailnet>.ts.net` (or `http://<NAS-Tailscale-IP>:8080`).
4. Sign in with your personal application username and password.
5. Lock your screen when you leave your desk (Windows ⊞+L, Mac Ctrl+Cmd+Q).

**Troubleshooting remote access**
| Problem | Solution |
|---|---|
| Page does not load | Tailscale on the laptop running and connected? Device approved? NAS online in the admin console? |
| "Your session has expired" | Sign in again (automatic sign-out after inactivity; see `SESSION_IDLE_MINUTES`). |
| Sign-in always fails on http:// | `COOKIE_SECURE=true` is set – use the `https://…ts.net` address. |
| Very slow | Check the internet connection of the office/NAS; Tailscale shows "relay" if a direct connection is not possible – usually still fine. |

## Offboarding – when an employee leaves JARBOU (do it on the last working day)

1. **Settings → Users →** the person **→ Deactivate.** This immediately ends all their sessions and
   blocks sign-in. The account (and its history) stays for the audit trail.
2. **Tailscale admin console → Machines →** remove the person's devices, and **Users →** remove/suspend the user.
3. If they had admin rights: change `POSTGRES_PASSWORD` is **not** necessary (they never knew it), but
   rotate any shared NAS passwords they knew.
4. The deactivation is recorded in the **Audit Log** (Settings → Audit Log / sidebar *Audit Log*).

## Moving the data of the old offline version

If data was entered in the previous offline version (single browser):
1. In the **old** version: Settings → *Backup Data* → a `.json` file is downloaded.
2. In the **NAS** version, as admin: **Settings → Import offline backup** → choose the file.
3. The preview shows how many candidates will be imported and which ones already exist
   (**duplicates are skipped by default** – nothing existing is overwritten).
4. Confirm. The import is recorded in the audit log.

## Security summary
- Passwords are stored only as Argon2id hashes; nobody (not even admins) can read them.
- Sessions: HttpOnly cookie, automatic sign-out after inactivity, all sessions ended on deactivation / password reset / restore.
- Every permission is enforced by the server (401 not signed in / 403 not allowed).
- PostgreSQL is only reachable inside Docker; no port is published.
- Uploaded documents are stored outside the web folder and are only delivered after sign-in and permission check.
- No analytics, no external scripts or fonts, no cloud services – all data stays on the JARBOU NAS.
- Audit log is append-only (the database itself refuses changes or deletion of entries).

## Troubleshooting

| Symptom | Check |
|---|---|
| Container `app` restarts again and again | Log of the app container. "POSTGRES_PASSWORD" message → `.env` missing or wrong name. "Database not reachable" → `db` container not healthy. |
| `db` not healthy after changing `POSTGRES_PASSWORD` | The database password is set only at the **first** start. Changing it later in `.env` does not change the database. Put the old value back (or ask IT to change it inside PostgreSQL). |
| "No users exist yet" in the log | `INITIAL_ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` missing or the password was rejected (log says why, e.g. contains the username). Fix `.env` and restart the app container, or use `create-admin`. |
| Forgot admin password | `docker compose exec app node src/cli.js reset-password <username>` |
| Port 8080 already used | Change `APP_PORT` in `.env`, restart the project, use the new port in the URL. |
| Uploads fail with "file type not allowed" | Allowed: PDF, JPG, PNG, WEBP, HEIC, DOCX, XLSX up to `UPLOAD_MAX_MB` (default 15 MB). |
| Backup status "failed" | Settings → Backups shows the message; usually the NAS disk is full. |

### Command line (SSH) instead of the UGOS project dialog
```bash
cd /volume1/docker/jarbou-recruiting     # adjust to your folder
cp .env.example .env && nano .env        # step 4
docker compose up -d --build             # step 5
docker compose ps                        # step 6
```
