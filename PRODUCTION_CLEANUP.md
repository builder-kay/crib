# Production Cleanup Guide

## Overview

Crib has been cleaned for production deployment. All demo/trial users and sample assets have been removed.

## What Was Removed

### Demo Users (7 total)
- **Creators (5):**
  - Adjoa Mensah (adjoa.templates@example.com) - Photoshop templates
  - Lilian Wekesa (lilian.templates@example.com) - Illustrator templates
  - Banele Khumalo (banele.templates@example.com) - After Effects templates
  - Tosin Adebayo (tosin.templates@example.com) - InDesign templates
  - Kojo Beatlab (kojo.beats@example.com) - Music producer

- **Buyers (2):**
  - Amina Bello (amina.buyer@example.com) - Buyer account
  - David Cole (david.buyer@example.com) - Buyer account

### Sample Data Removed
- **Assets:** 7 demo template/music packs (with full details and previews)
- **Orders:** 5 sample orders with payments
- **Reviews:** 6 asset reviews + 4 creator reviews
- **Interactions:** Wishlists, follows, release notifications
- **Transactions:** Wallet transactions and payout accounts
- **Analytics:** Demo event tracking data

## Migration & Seed Updates

### Migration Applied
**File:** `supabase/migrations/202605260001_remove_seed_demo_data.sql`

This migration:
- Safely deletes all 7 seed users and their related data
- Uses a CTE to identify seed users by their known UUIDs
- Removes data in reverse dependency order to avoid foreign key violations
- Is idempotent and safe to run multiple times

### Seed File Updated
**File:** `supabase/seed.sql`

- Now contains only comments (no insertions)
- Safe to run after migrations
- Ready for production initialization data as needed

## Deployment Steps

### For Development Environment

If you already have demo data in your dev environment and want to clean it:

1. **Apply the migration:**
   ```bash
   supabase migration up --db-url $SUPABASE_DB_URL
   ```

2. **Run the empty seed file (optional):**
   ```bash
   supabase seed.sql
   ```

### For Staging/Production

1. **Before deployment:**
   - Ensure all existing demo users are backed up if needed (check git history)
   - Confirm no real users have these demo email addresses

2. **Deploy the migration:**
   - Apply migration `202605260001_remove_seed_demo_data.sql` to staging
   - Verify no data loss of production users
   - Deploy to production

3. **Verify cleanup:**
   - Check that seed user UUIDs no longer exist in auth.users
   - Confirm assets table has no entries with demo creator IDs
   - Verify orders/payments are clean

## Restoring Demo Data (Development Only)

If you need demo data back for development:

1. Check git history for the original seed.sql:
   ```bash
   git log --oneline supabase/seed.sql | head -5
   ```

2. Checkout the original version:
   ```bash
   git show <commit>:supabase/seed.sql > supabase/seed.sql.bak
   ```

3. Restore demo users and data:
   - Revert the cleanup migration (if needed)
   - Re-run the demo seed.sql from git history

## Important Notes

⚠️ **Irreversible:** Once this migration is applied to a production database, all demo data is permanently removed. Ensure you have backups before applying to production.

✅ **Foreign Key Safe:** The migration respects all foreign key constraints by deleting in the correct order.

✅ **Idempotent:** Safe to run multiple times - won't cause errors if demo data doesn't exist.

## Sample Assets in Storage

Sample asset files were referenced in the demo data with paths like:
- `seed/11111111-1111-4111-8111-111111111111/*/...`

These storage paths will be orphaned after the cleanup. To completely clean up:

1. Connect to your Supabase storage bucket
2. Delete any files under `assets/seed/` paths (optional)

## Questions?

Refer to the migration file for the exact SQL logic used to clean up data. All related records are deleted with proper transaction safety.
