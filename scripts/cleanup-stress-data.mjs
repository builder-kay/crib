import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();
const CHUNK_SIZE = 250;
const STRESS_EMAIL_DOMAINS = ["@crib.local", "@cribstress.com"];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function loadEnv() {
  loadEnvFile(path.join(ROOT_DIR, ".env"));
  loadEnvFile(path.join(ROOT_DIR, "apps", "web", ".env.local"));
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function chunkArray(items, size = CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isStressEmail(email) {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("stress.")) {
    return true;
  }

  return STRESS_EMAIL_DOMAINS.some((suffix) => normalized.endsWith(suffix));
}

async function listStressUserIds(supabase) {
  const ids = [];
  const emails = [];

  const perPage = 200;
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      if (isStressEmail(user.email)) {
        ids.push(user.id);
        emails.push((user.email ?? "").toLowerCase());
      }
    }

    if (users.length < perPage) {
      break;
    }
  }

  return {
    userIds: unique(ids),
    emails: unique(emails)
  };
}

async function collectIdsByIn(supabase, table, column, values, selectColumn = "id") {
  const ids = [];
  for (const chunk of chunkArray(values)) {
    const { data, error } = await supabase
      .from(table)
      .select(selectColumn)
      .in(column, chunk);

    if (error) {
      throw new Error(`Unable to fetch ${table}.${selectColumn} by ${column}: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (row && row[selectColumn]) {
        ids.push(row[selectColumn]);
      }
    }
  }

  return unique(ids);
}

async function collectOrderIdsByStressEmail(supabase) {
  const ids = [];
  const pageSize = 1000;

  for (let start = 0; start < 100_000; start += pageSize) {
    const end = start + pageSize - 1;
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .like("email", "stress.%")
      .range(start, end);

    if (error) {
      throw new Error(`Unable to fetch stress-email orders: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      if (row.id) {
        ids.push(row.id);
      }
    }

    if (rows.length < pageSize) {
      break;
    }
  }

  return unique(ids);
}

async function collectTestPayoutCreatorIds(supabase) {
  const { data, error } = await supabase
    .from("creator_payout_accounts")
    .select("creator_id")
    .contains("metadata", { test_mode: true });

  if (error) {
    throw new Error(`Unable to fetch test payout rows: ${error.message}`);
  }

  return unique((data ?? []).map((row) => row.creator_id));
}

async function deleteByIds(supabase, table, column, ids, dryRun) {
  if (ids.length === 0) {
    return 0;
  }

  if (dryRun) {
    return ids.length;
  }

  let deletedApprox = 0;
  for (const chunk of chunkArray(ids)) {
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) {
      throw new Error(`Failed deleting from ${table} by ${column}: ${error.message}`);
    }
    deletedApprox += chunk.length;
  }

  return deletedApprox;
}

async function deleteAuthUsers(supabase, userIds, dryRun) {
  if (userIds.length === 0) {
    return 0;
  }

  if (dryRun) {
    return userIds.length;
  }

  let deleted = 0;
  for (const userId of userIds) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Failed deleting auth user ${userId}: ${error.message}`);
    }
    deleted += 1;
  }

  return deleted;
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    requiredEnv("SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  }

  const dryRun = process.argv.includes("--dry-run");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const stressAuth = await listStressUserIds(supabase);
  const testPayoutCreatorIds = await collectTestPayoutCreatorIds(supabase);

  const stressCreatorIds = unique([...stressAuth.userIds, ...testPayoutCreatorIds]);

  const stressAssetIds = await collectIdsByIn(supabase, "assets", "creator_id", stressCreatorIds, "id");

  const orderIdsByBuyer = await collectIdsByIn(supabase, "orders", "buyer_id", stressCreatorIds, "id");
  const orderIdsByAsset = await collectIdsByIn(supabase, "orders", "asset_id", stressAssetIds, "id");
  const orderIdsByEmail = await collectOrderIdsByStressEmail(supabase);
  const stressOrderIds = unique([...orderIdsByBuyer, ...orderIdsByAsset, ...orderIdsByEmail]);

  const paymentIds = await collectIdsByIn(supabase, "payments", "order_id", stressOrderIds, "id");
  const walletTxByOrderIds = await collectIdsByIn(supabase, "wallet_tx", "order_id", stressOrderIds, "id");
  const walletTxByCreatorIds = await collectIdsByIn(supabase, "wallet_tx", "creator_id", stressCreatorIds, "id");
  const walletTxIds = unique([...walletTxByOrderIds, ...walletTxByCreatorIds]);

  const assetPreviewIds = await collectIdsByIn(supabase, "asset_previews", "asset_id", stressAssetIds, "id");
  const assetFileIds = await collectIdsByIn(supabase, "asset_files", "asset_id", stressAssetIds, "id");
  const payoutCreatorIds = unique([...stressCreatorIds, ...testPayoutCreatorIds]);

  console.log(`Mode: ${dryRun ? "DRY RUN" : "DELETE"}`);
  console.log(`Stress auth users:        ${stressAuth.userIds.length}`);
  console.log(`Stress creators:          ${stressCreatorIds.length}`);
  console.log(`Stress assets:            ${stressAssetIds.length}`);
  console.log(`Stress orders:            ${stressOrderIds.length}`);
  console.log(`Related payments:         ${paymentIds.length}`);
  console.log(`Related wallet tx:        ${walletTxIds.length}`);
  console.log(`Related asset previews:   ${assetPreviewIds.length}`);
  console.log(`Related asset files:      ${assetFileIds.length}`);
  console.log(`Test payout creator rows: ${payoutCreatorIds.length}`);

  if (dryRun) {
    console.log("");
    console.log("Dry run complete. No data was deleted.");
    return;
  }

  await deleteByIds(supabase, "payments", "id", paymentIds, false);
  await deleteByIds(supabase, "wallet_tx", "id", walletTxIds, false);
  await deleteByIds(supabase, "orders", "id", stressOrderIds, false);
  await deleteByIds(supabase, "asset_files", "id", assetFileIds, false);
  await deleteByIds(supabase, "asset_previews", "id", assetPreviewIds, false);
  await deleteByIds(supabase, "assets", "id", stressAssetIds, false);
  await deleteByIds(supabase, "creator_payout_accounts", "creator_id", payoutCreatorIds, false);
  await deleteByIds(supabase, "admins", "user_id", stressCreatorIds, false);
  await deleteByIds(supabase, "wallet", "creator_id", stressCreatorIds, false);
  await deleteByIds(supabase, "profiles", "id", stressCreatorIds, false);
  await deleteAuthUsers(supabase, stressAuth.userIds, false);

  console.log("");
  console.log("Cleanup complete.");
}

main().catch((error) => {
  console.error("Cleanup failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
