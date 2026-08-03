# Admin Access — How It Works Now

Updated 2026-08-03 (bogus-admin revocation + env-allowlist rework).

## What changed

- The hardcoded "admin wallet" `Fu7Qnu...YdUD` (a February demo placeholder bound to a keypair of unknown ownership) was removed from all client code, and its `is_admin=true` row was deleted from the live database.
- The "Experimental Bypass" one-click wallet buttons were removed from the wallet modal. Only real Phantom connection remains, and it now requires a signed message (ed25519 signature verified server-side).
- Admin authority is no longer decided by any hardcoded address or by the client. Every `/api/admin/*` route (and `/api/creators/approve`) now runs `requireAdmin()` from `packages/dashboard/src/lib/adminAuth.ts`.

## The rule

A wallet is an admin **iff BOTH**:

1. It authenticated with a real wallet signature (Phantom sign-in issues a JWT session via `POST /api/auth/session`), **and**
2. Its address is listed in the `ADMIN_WALLETS` environment variable (comma-separated allowlist, server-side only).

If `ADMIN_WALLETS` is unset or empty, **nobody is admin** — all admin endpoints return 503/401/403. That is the current (safe) state. The admin lane also refuses to operate unless `JWT_SECRET` is explicitly set, so the development fallback secret can never be used to forge an admin session.

The client only learns admin status from the server (`GET /api/auth/session` returns `isAdmin`).

## To claim admin (Preston — one step)

Set your REAL Phantom wallet address in Vercel and redeploy:

```
vercel env add ADMIN_WALLETS production
# paste your Phantom wallet address when prompted
# ensure JWT_SECRET is also set to a long random value:
vercel env add JWT_SECRET production
vercel --prod
```

(Or in the Vercel dashboard: Project → Settings → Environment Variables → add `ADMIN_WALLETS` = your address, confirm `JWT_SECRET` is set, then redeploy.)

Then open the site, click Connect Wallet → Phantom, and approve the signature prompt. The server verifies the signature, sees your address on the allowlist, and your session gets admin. Multiple admins: comma-separate addresses in `ADMIN_WALLETS`.

Do NOT put a placeholder value in `ADMIN_WALLETS`. Never hardcode wallet addresses in code again — the allowlist lives only in the environment.
