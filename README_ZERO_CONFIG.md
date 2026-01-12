Zero-config deployment (INSECURE - read before using)

This project now includes a "zero-config" convenience mode that allows you to deploy the full app to Vercel (and use the included GitHub Actions workflow) without setting environment variables.

What the zero-config files do (already present in the repository):
- `betting-at-developers-smc-firebase-adminsdk-fbsvc-9145d29124.json` — Firebase service account JSON (grants full admin privileges to your RTDB)
- `admin_token.txt` — Admin token used to protect the settlement endpoint

How the code behaves now:
- `api/settle-virtual.ts` will initialize Firebase Admin from (in priority order):
  1. `SERVICE_ACCOUNT_JSON` or `SERVICE_ACCOUNT_BASE64` environment variable (preferred)
  2. The repo-local JSON file `betting-at-developers-smc-firebase-adminsdk-fbsvc-9145d29124.json` (zero-config fallback)
  3. Default application credentials (if present)

- The admin token is resolved from `ADMIN_TOKEN` environment variable, or from the repo-local `admin_token.txt` file when the env var is not set.

Security warning (you must read this):
- Committing a Firebase service account JSON and/or admin token into a public or shared repository is extremely dangerous: anyone with that file can read/write your entire Realtime Database, impersonate services, and access other GCP resources depending on the account's privileges.
- If you choose "zero-config" for convenience, restrict repository access (private repo), rotate the service account key after use, and plan to move secrets to proper secret storage (Vercel environment variables or GitHub Secrets) as soon as possible.

Quick deploy steps (zero-config):
1. Deploy the repo to Vercel (the repo contains the service-account JSON and `admin_token.txt`).
2. Configure GitHub Actions secret `SETTLE_URL` to point to `https://<your-vercel-app>/api/settle-virtual`.
3. (Optional) Let `.github/workflows/settlement-cron.yml` call your endpoint on schedule.

If you want help switching to a secure setup (recommended), I can move secrets into Vercel env vars and update the workflow to use GitHub Secrets instead.
