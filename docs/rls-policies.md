# CRIB RLS Policies

## Core Principles

- Every table has RLS enabled.
- Public access is minimal and explicit.
- Authenticated creators can manage only their own records.
- Paid-buyer checks gate private file access.
- Wallet visibility is owner-only.

## Table Policies

### `profiles`
- `SELECT`: public read
- `INSERT`: only self (`auth.uid() = id`)
- `UPDATE`: only self

### `admins`
- `SELECT`: own row or existing admins
- `ALL`: admins can manage admin assignments

### `assets`
- `SELECT`: published assets are public
- `SELECT`: creator can read own drafts/archived
- `INSERT/UPDATE/DELETE`: creator-only for own assets
- `ALL`: admins can moderate all assets

### `asset_previews`
- `SELECT`: public read
- `INSERT/UPDATE/DELETE`: only creator/admin of parent asset

### `asset_files`
- `INSERT/UPDATE/DELETE`: only creator/admin of parent asset
- `SELECT`:
  - creator/admin of parent asset, or
  - buyer with paid order, or
  - valid `x-order-token` header matching order token

### `orders`
- `SELECT`:
  - buyer by `buyer_id`, or
  - buyer by email claim (`auth.jwt() ->> 'email'`), or
  - valid `x-order-token` header, or
  - creator of ordered asset, or
  - admin
- `INSERT`: authenticated users can create orders for themselves (service role also bypasses RLS)

### `payments`
- `SELECT`: buyer, creator of ordered asset, or admin

### `wallet`
- `SELECT`: creator own wallet or admin

### `wallet_tx`
- `SELECT`: creator own transactions or admin

### `creator_payout_accounts`
- `SELECT`: creator own payout account or admin
- `INSERT/UPDATE`: creator can manage own payout account
- `ALL`: admin can manage payout accounts

## Storage Policies

### Bucket: `previews` (public)
- `SELECT`: public
- `INSERT/UPDATE/DELETE`: authenticated creator only for path prefix `auth.uid()/...`

### Bucket: `assets` (private)
- `INSERT`: authenticated creator only for path prefix `auth.uid()/...`
- `UPDATE/DELETE`: creator/admin if object maps to creator-owned asset file
- `SELECT`:
  - creator/admin access to own objects
  - paid buyer access by order relationship
  - `x-order-token` support for email-link access

## Helper Functions

- `request_order_token()`: reads `x-order-token` from request headers for RLS evaluation.
- `credit_wallet(...)`: idempotent wallet crediting with duplicate transaction protection (`unique(order_id, type)`).
- `handle_auth_user_created()`: auto-provisions profile + wallet on signup.
