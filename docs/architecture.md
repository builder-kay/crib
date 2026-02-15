# CRIB Architecture

## Overview
CRIB is a marketplace-first platform where creators list and sell digital assets (templates, beats, presets, fonts, photos, videos, and more).

- Frontend: Vite + React + TypeScript + Tailwind + React Router + TanStack Query + Zustand + Zod
- Backend: Supabase Auth + Postgres + Storage + Edge Functions
- Payments: Paystack (initialize + webhook verification)
- Hosting: Frontend on Vercel/Netlify, backend on Supabase

## High-Level Flow

### Creator flow
1. Creator signs up with Supabase Auth.
2. Trigger creates `profiles` and `wallet` records.
3. Creator uploads asset metadata to `assets` and files to private `assets` bucket.
4. Creator uploads preview images to public `previews` bucket.
5. Marketplace lists published assets.

### Buyer flow
1. Buyer opens asset detail page.
2. Frontend calls `create-payment` edge function.
3. Function creates pending `orders` + `payments`, then initializes Paystack transaction.
4. Buyer completes checkout on Paystack.
5. Paystack sends webhook to `paystack-webhook`.
6. Webhook verifies signature and transaction status.
7. On success: `payments` and `orders` become paid; creator wallet is credited net of commission.
8. Buyer requests secure download via `generate-download`, receives short-lived signed URL.

## Data + Security Model

- RLS enabled on all marketplace tables.
- Public reads only for published assets and creator profiles.
- Private asset files protected in Storage bucket (`assets`).
- Downloads issued via signed URLs after paid-order checks.
- Wallet and wallet transaction rows are creator-private.
- Admin moderation is supported through `admins` table + policies.

## Edge Functions

### `create-payment`
- Validates `asset_id` and buyer email/user
- Creates pending order
- Initializes Paystack transaction
- Persists payment reference
- Returns checkout URL

### `paystack-webhook`
- Verifies `x-paystack-signature` using HMAC SHA-512
- Calls Paystack verify endpoint
- Marks payment/order paid or failed
- Credits wallet using DB RPC `credit_wallet`

### `generate-download`
- Requires order context + auth or order token
- Checks paid status (or creator/admin access)
- Generates signed URL from private bucket with short expiry

## Commission Model

- `COMMISSION_BPS` controls platform commission in basis points.
- Example: `1000` = 10%
- `net = order.amount_kobo - floor(order.amount_kobo * COMMISSION_BPS / 10000)`

## Frontend Route Map

- `/` landing
- `/market` browse/search/filter assets
- `/asset/:id` asset detail + purchase
- `/auth` login/register
- `/dashboard` creator analytics + profile
- `/upload` create asset + upload files
- `/orders` buyer orders + signed downloads
- `/admin` moderation panel (admin users)