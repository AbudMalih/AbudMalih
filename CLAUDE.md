# JARBOU Logistik GmbH – repository guide

## The website lives in `web/`

- **`web/`** is the one and only JARBOU Logistik website (Next.js 16 App Router,
  React 19, TypeScript, Tailwind 4, GSAP). All website work happens here.
  Run every npm command from `web/` (`cd web && npm install && npm run build`).
- Vercel project `jarbou-web-preview` builds with **Root Directory `web`**,
  Framework Next.js, default build command (`next build`) and default output.
  Do not move the app out of `web/` and do not add a root-level `vercel.json`.
- The Next.js app at the repository root (`app/`, `components/`, `lib/`,
  `next.config.js`, …) is the **old prototype**, kept for reference only.
  Do not edit, build or deploy it.

## Branches

- Main website branch: `claude/fervent-hopper-gibb4h` (Vercel production).
- Other `claude/*` branches hold separate projects (Luna Trading website,
  JARBOU Recruiting Command Center, TURVIO). They are not versions of this
  website. Do not merge them into `web/` and do not delete them.

## Content and data

- Editable content is typed in `web/src/content/*` (jobs, locations,
  services, legal, …); see `web/README.md` → "Inhalte pflegen".
- Never invent legal information, salaries, addresses, vacancies or
  statistics. Jobs are public only with `status: "published"`.

## Rules that always apply

- Keep the approved design, official branding and the lightweight motion
  system (including the rendered truck film in `web/public/journey`).
- No Google Analytics, Meta Pixel or other ad trackers.
- SMTP credentials only in server-side environment variables;
  `.env.example` holds placeholders only. Never log applicant data, never
  store application documents permanently, never send applicants marketing
  e-mails.
- Do not use the DHL Express logo. "J&T" must not appear anywhere.
- Before committing: `cd web && npm run lint && npm run typecheck && npm run build`.
