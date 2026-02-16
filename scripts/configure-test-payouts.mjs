import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();

const PROVIDERS = [
  { code: "mtn_test", name: "MTN Mobile Money" },
  { code: "telecel_test", name: "Telecel Cash" },
  { code: "airteltigo_test", name: "AirtelTigo Money" }
];

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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function makeSubaccountCode(creatorId) {
  const compact = creatorId.replace(/-/g, "").slice(0, 20).toUpperCase();
  return `TEST_SUB_${compact}`;
}

function makeLast4(index) {
  return String(1000 + (index % 9000)).slice(-4);
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    requireEnv("SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: creatorAssets, error: creatorAssetsError } = await supabase
    .from("assets")
    .select("creator_id")
    .eq("status", "published");

  if (creatorAssetsError) {
    throw new Error(`Unable to load creators from assets: ${creatorAssetsError.message}`);
  }

  const creatorIds = [...new Set((creatorAssets ?? []).map((row) => row.creator_id).filter(Boolean))];
  if (creatorIds.length === 0) {
    console.log("No creators with published assets found.");
    return;
  }

  const { data: existingRows, error: existingRowsError } = await supabase
    .from("creator_payout_accounts")
    .select("creator_id")
    .in("creator_id", creatorIds);

  if (existingRowsError) {
    throw new Error(`Unable to load existing payout rows: ${existingRowsError.message}`);
  }

  const existingCreatorIds = new Set((existingRows ?? []).map((row) => row.creator_id));
  const targetCreatorIds = creatorIds.filter((id) => !existingCreatorIds.has(id));

  if (targetCreatorIds.length === 0) {
    console.log(`All ${creatorIds.length} creators already have payout rows. Nothing to insert.`);
    return;
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", targetCreatorIds);

  if (profilesError) {
    throw new Error(`Unable to load profiles for target creators: ${profilesError.message}`);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const payload = targetCreatorIds.map((creatorId, index) => {
    const provider = PROVIDERS[index % PROVIDERS.length];
    const profile = profileMap.get(creatorId);
    const displayName = profile?.display_name?.trim() || "Creator";

    return {
      creator_id: creatorId,
      provider: "paystack",
      status: "active",
      payout_type: "mobile_money",
      country: "ghana",
      business_name: displayName.slice(0, 120),
      subaccount_code: makeSubaccountCode(creatorId),
      settlement_bank_code: provider.code,
      settlement_bank_name: provider.name,
      account_number_last4: makeLast4(index),
      account_name: displayName.slice(0, 120),
      metadata: {
        test_mode: true,
        configured_by: "scripts/configure-test-payouts.mjs",
        provider_priority: ["MTN Mobile Money", "Telecel Cash", "AirtelTigo Money"],
        note: "Synthetic payout row for stress-test browsing. Not valid for real settlement."
      }
    };
  });

  const { error: insertError } = await supabase
    .from("creator_payout_accounts")
    .insert(payload);

  if (insertError) {
    throw new Error(`Unable to insert test payout rows: ${insertError.message}`);
  }

  const countsByProvider = payload.reduce((acc, item) => {
    const key = item.settlement_bank_name || item.settlement_bank_code;
    acc.set(key, (acc.get(key) ?? 0) + 1);
    return acc;
  }, new Map());

  console.log("Test payout configuration complete.");
  console.log(`Creators with published assets: ${creatorIds.length}`);
  console.log(`Already configured:           ${existingCreatorIds.size}`);
  console.log(`Newly configured:             ${payload.length}`);
  console.log("Provider distribution:");
  for (const [provider, count] of countsByProvider.entries()) {
    console.log(`- ${provider}: ${count}`);
  }
}

main().catch((error) => {
  console.error("Failed to configure test payouts:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
