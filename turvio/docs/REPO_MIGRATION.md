# Plan: moving TURVIO to a private Lunapact repository

**Status: proposal – not executed. Requires approval.**

Today TURVIO lives in `turvio/` inside the JARBOU website repository (`abudmalih/abudmalih`). It is self-contained: own `package.json`, lockfile, `.gitignore`, docs, and no imports from the website. The website is untouched.

## Target

* New **private** GitHub repository owned by a Lunapact Technologies organization, e.g. `lunapact/turvio`.
* Repository root = current `turvio/` folder.
* History of `turvio/` preserved.

## Steps (after approval)

1. Lunapact creates the GitHub organization (2FA required for members) and an empty private repo `turvio`. Decide on owners/maintainers.
2. Extract the folder with history (on a fresh clone, never on the working copy):
   ```bash
   git clone https://github.com/abudmalih/abudmalih.git turvio-extract
   ```
   ```bash
   cd turvio-extract && git filter-repo --subdirectory-filter turvio
   ```
   ```bash
   git remote add origin git@github.com:lunapact/turvio.git && git push -u origin --all
   ```
3. In the new repo: branch protection on `main` (PR reviews, required CI), CODEOWNERS, Dependabot, secret scanning, GitHub Actions CI (pnpm install, typecheck, tests for shared/db/api/driver/dispatch/admin, `pytest` for the optimizer, `next build`, `expo export`).
4. Move secrets/accounts to Lunapact ownership: Supabase project, EAS/Expo account (publisher for `com.lunapact.turvio.driver`), Apple/Google developer accounts, Stripe (later), domain(s).
5. Remove `turvio/` from the website repository in a separate, reviewed PR (website files unaffected) and add a short note pointing to the new location.
6. Contributor/IP paperwork: confirm that all code written so far is assigned to Lunapact Technologies (contracts with developers/contractors), add a LICENSE (proprietary) and NOTICE for third-party licences.

## Risks / checks

* Nothing secret has been committed (verified: only `.env.example` files). Re-scan with secret scanning after the move.
* The website deployment must not depend on `turvio/` (it doesn't: separate package.json; the website's build ignores the folder). Confirm the hosting config after step 5.
