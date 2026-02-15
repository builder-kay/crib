# CRIB

Production-ready MVP scaffold for **CRIB** - an African-first digital marketplace for creators selling digital assets.

## Stack

- Frontend: Vite, React, TypeScript, Tailwind, React Router, TanStack Query, Zustand, Zod
- Backend: Supabase Auth, Postgres, Storage, RLS, Edge Functions
- Payments: Paystack (initialize + webhook verify)
- Hosting: Vercel/Netlify (frontend), Supabase (backend)

## Monorepo Structure

```txt
crib/
  apps/
    web/
  supabase/
    migrations/
    functions/
      create-payment/
      paystack-webhook/
      generate-download/
  docs/
  .env.example
  README.md
```

## MVP Features Implemented

- Auth (signup/login) with Supabase
- Creator profile editing
- Asset uploads to private storage (`assets`) + public previews (`previews`)
- Marketplace browse/search/filter
- Asset detail and purchase kickoff via Paystack
- Paystack webhook verification and payment/order updates
- Creator wallet crediting with configurable commission
- Secure buyer downloads through signed URLs
- Creator dashboard (orders/revenue/wallet summary)
- Minimal admin moderation route (`/admin`)

## Environment Variables

Use `.env.example` as template.

### Frontend (`apps/web/.env.local`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL`
- `VITE_PAYSTACK_PUBLIC_KEY`

### Edge Functions / Backend (Supabase secrets)

- `PAYSTACK_PUBLIC_KEY`
- `PAYSTACK_SECRET_KEY`
- `COMMISSION_BPS` (example: `1000` for 10%)
- `SITE_URL` (frontend base URL)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create Supabase project and link CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

3. Apply DB migrations:

```bash
supabase db push
```

4. Set function secrets:

```bash
supabase secrets set PAYSTACK_PUBLIC_KEY=<pk_test_or_live>
supabase secrets set PAYSTACK_SECRET_KEY=<sk_test_or_live>
supabase secrets set COMMISSION_BPS=1000
supabase secrets set SITE_URL=http://localhost:5173
```

5. Deploy functions:

```bash
supabase functions deploy create-payment
supabase functions deploy paystack-webhook
supabase functions deploy generate-download
```

6. Set Paystack webhook URL:

```txt
https://<project-ref>.functions.supabase.co/paystack-webhook
```

7. Start frontend:

```bash
npm run dev
```

## Deploying

### Frontend (Vercel / Netlify)

- Root directory: `apps/web`
- Build command: `npm run build`
- Output dir: `dist`
- Add frontend env vars in hosting dashboard

### Supabase

- Keep migrations in `supabase/migrations`
- Deploy functions after changes
- Set production secrets (`PAYSTACK_*`, `COMMISSION_BPS`, `SITE_URL`)

## Admin Access

Add admin users by inserting their `auth.users.id` into `admins`:

```sql
insert into public.admins (user_id)
values ('<auth-user-uuid>')
on conflict (user_id) do nothing;
```

## Security Notes

- RLS enabled on all core tables
- Asset files stored in private bucket
- Public previews isolated in separate bucket
- Downloads require paid-order verification
- Webhook signature validated with HMAC SHA-512
- Wallet credits are idempotent via `credit_wallet` RPC + unique tx constraint

## Scripts

From repo root:

- `npm run dev` - run web app in dev mode
- `npm run build` - typecheck + production build
- `npm run typecheck` - TS checks

## Docs

- `docs/architecture.md`
- `docs/rls-policies.md`