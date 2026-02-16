import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();
const DEFAULT_CREATOR_COUNT = 50;
const DEFAULT_ASSETS_PER_CREATOR = 3;

const CREATOR_CATEGORIES = [
  "Music Producer",
  "Designer",
  "Photographer",
  "Video Creator",
  "UI Specialist",
  "Brand Builder",
  "Content Strategist",
  "Template Maker"
];

const NICHES = [
  "Afrobeats production",
  "Minimal brand systems",
  "Social media campaigns",
  "Editorial storytelling",
  "Short-form video kits",
  "Creator monetization",
  "Premium presets",
  "Digital product design"
];

const ASSET_CATEGORIES = [
  "Templates",
  "Beats",
  "Presets",
  "UI Kits",
  "Fonts",
  "Photos",
  "Videos",
  "Mockups",
  "Other"
];

const FIRST_NAMES = [
  "Ama", "Kwame", "Nana", "Kojo", "Kofi", "Adwoa", "Esi", "Akua", "Yaw", "Kojo",
  "Zuri", "Musa", "Tari", "Ayo", "Chika", "Kemi", "Lerato", "Neo", "Tumi", "Amina",
  "Sade", "Nia", "Imani", "Kabelo", "Femi", "Yemi", "Bisi", "Tosin", "Mpho", "Zanele",
  "Amara", "Dayo", "Aisha", "Seyi", "Kunle", "Lulu", "Dami", "Kelechi", "Nuru", "Fola",
  "Temi", "Yara", "Rudo", "Lebo", "Bongani", "Tayo", "Kiki", "Ari", "Mira", "Ola",
  "Sani", "Mena", "Ife", "Tariro", "Nkechi", "Abeni", "Zainab", "Mazi", "Soma", "Deka"
];

const LAST_NAMES = [
  "Mensah", "Boateng", "Asante", "Okoro", "Adebayo", "Adeyemi", "Ndlovu", "Mokoena", "Nkosi", "Banda",
  "Kamau", "Mutiso", "Diallo", "Sow", "Traore", "Hassan", "Abiola", "Akinola", "Sarpong", "Danquah",
  "Owusu", "Amoako", "Balogun", "Adebisi", "Okafor", "Eze", "Mabena", "Chukwu", "Yakubu", "Kone",
  "Sule", "Lawal", "Moyo", "Mandela", "Maseko", "Afolabi", "Osei", "Tetteh", "Quaye", "Ankomah",
  "Bello", "Ajayi", "Olawale", "Akinyemi", "Adekunle", "Adewale", "Aderemi", "Tawiah", "Gyasi", "Kwarteng"
];

const ASSET_NAME_BITS = [
  "Starter Pack",
  "Creator Bundle",
  "Growth Kit",
  "Viral Set",
  "Launch Toolkit",
  "Conversion Pack",
  "Campaign Vault",
  "Studio Essentials",
  "Pro Preset Set",
  "Instant Template"
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

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

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

function toTwoDigits(value) {
  return String(value).padStart(2, "0");
}

function pickFrom(list, index) {
  return list[index % list.length];
}

function creatorIdentity(index) {
  const first = pickFrom(FIRST_NAMES, index);
  const last = pickFrom(LAST_NAMES, index + 7);
  const displayName = `${first} ${last}`;
  const creatorCategory = pickFrom(CREATOR_CATEGORIES, index + 2);
  const niche = pickFrom(NICHES, index + 4);
  const sequence = toTwoDigits(index + 1);
  const email = `stress.creator.${sequence}@cribstress.com`;
  const password = `StressTest#${sequence}Ab`;
  const handle = `${first}.${last}`.toLowerCase();

  return {
    displayName,
    creatorCategory,
    niche,
    email,
    password,
    avatarUrl: `https://i.pravatar.cc/300?u=crib-stress-${sequence}`,
    socials: {
      website: `https://crib.example/${handle}`,
      instagram: handle,
      x: handle.replace(".", "_")
    }
  };
}

function assetDefinition(creatorIndex, assetIndex) {
  const seq = `${creatorIndex + 1}-${assetIndex + 1}`;
  const category = pickFrom(ASSET_CATEGORIES, creatorIndex + assetIndex);
  const assetName = pickFrom(ASSET_NAME_BITS, creatorIndex * 3 + assetIndex);
  const title = `Stress ${assetName} ${seq}`;
  const description = [
    `Seeded stress-test asset for creator ${creatorIndex + 1}.`,
    `Category: ${category}.`,
    "Built to simulate real marketplace browsing with populated profiles and listings.",
    "Includes rich preview metadata for visual verification."
  ].join(" ");
  const priceKobo = 2_500 + ((creatorIndex * 317 + assetIndex * 193) % 12_000);
  const tagA = category.toLowerCase().replace(/\s+/g, "-");
  const tagB = pickFrom(["creator", "bundle", "premium", "launch", "growth"], creatorIndex + assetIndex);
  const previewUrl = `https://picsum.photos/seed/crib-stress-${creatorIndex + 1}-${assetIndex + 1}/1200/900`;

  return {
    title,
    description,
    category,
    priceKobo,
    tags: [tagA, tagB, "stress-test"],
    previewUrl
  };
}

async function findUserByEmail(adminClient, email) {
  const pageSize = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: pageSize
    });

    if (error) {
      throw new Error(`Unable to list users for lookup: ${error.message}`);
    }

    const users = data?.users ?? [];
    const found = users.find((user) => (user.email ?? "").toLowerCase() === email.toLowerCase());
    if (found) {
      return found;
    }

    if (users.length < pageSize) {
      break;
    }
  }

  return null;
}

async function ensureAuthUser(adminClient, identity) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: identity.email,
    password: identity.password,
    email_confirm: true,
    user_metadata: {
      display_name: identity.displayName,
      avatar_url: identity.avatarUrl
    }
  });

  if (!error && data?.user) {
    return { user: data.user, created: true };
  }

  const message = error?.message?.toLowerCase() ?? "";
  const likelyExists =
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists") ||
    message.includes("duplicate");

  if (!likelyExists) {
    throw new Error(`Unable to create user ${identity.email}: ${error?.message ?? "Unknown error"}`);
  }

  const existing = await findUserByEmail(adminClient, identity.email);
  if (!existing) {
    throw new Error(`User ${identity.email} seems to exist but could not be fetched.`);
  }

  return { user: existing, created: false };
}

async function ensureProfileAndAssets(client, userId, identity, creatorIndex, assetsPerCreator) {
  const bio = `${identity.displayName} builds ${identity.niche.toLowerCase()} assets for creators who need production-ready work fast.`;

  const { error: profileError } = await client
    .from("profiles")
    .upsert(
      {
        id: userId,
        display_name: identity.displayName,
        bio,
        avatar_url: identity.avatarUrl,
        creator_category: identity.creatorCategory,
        niche: identity.niche,
        socials: identity.socials
      },
      { onConflict: "id" }
    );

  if (profileError) {
    throw new Error(`Unable to upsert profile for ${identity.email}: ${profileError.message}`);
  }

  const stats = {
    assetsCreated: 0,
    assetsExisting: 0,
    previewsCreated: 0
  };

  for (let assetIndex = 0; assetIndex < assetsPerCreator; assetIndex += 1) {
    const assetDef = assetDefinition(creatorIndex, assetIndex);

    const { data: existingAsset, error: existingAssetError } = await client
      .from("assets")
      .select("id")
      .eq("creator_id", userId)
      .eq("title", assetDef.title)
      .maybeSingle();

    if (existingAssetError) {
      throw new Error(`Unable to query existing assets for ${identity.email}: ${existingAssetError.message}`);
    }

    let assetId = existingAsset?.id ?? null;
    if (!assetId) {
      const { data: insertedAsset, error: insertAssetError } = await client
        .from("assets")
        .insert({
          creator_id: userId,
          title: assetDef.title,
          description: assetDef.description,
          category: assetDef.category,
          tags: assetDef.tags,
          price_kobo: assetDef.priceKobo,
          currency: "GHS",
          status: "published"
        })
        .select("id")
        .single();

      if (insertAssetError || !insertedAsset) {
        throw new Error(`Unable to insert asset "${assetDef.title}" for ${identity.email}: ${insertAssetError?.message ?? "Unknown error"}`);
      }

      assetId = insertedAsset.id;
      stats.assetsCreated += 1;
    } else {
      stats.assetsExisting += 1;
      const { error: patchAssetError } = await client
        .from("assets")
        .update({
          description: assetDef.description,
          category: assetDef.category,
          tags: assetDef.tags,
          price_kobo: assetDef.priceKobo,
          currency: "GHS",
          status: "published"
        })
        .eq("id", assetId);

      if (patchAssetError) {
        throw new Error(`Unable to refresh asset "${assetDef.title}" for ${identity.email}: ${patchAssetError.message}`);
      }
    }

    const { data: existingPreview, error: existingPreviewError } = await client
      .from("asset_previews")
      .select("id")
      .eq("asset_id", assetId)
      .limit(1)
      .maybeSingle();

    if (existingPreviewError) {
      throw new Error(`Unable to query previews for ${identity.email}: ${existingPreviewError.message}`);
    }

    if (!existingPreview) {
      const { error: insertPreviewError } = await client.from("asset_previews").insert({
        asset_id: assetId,
        preview_url: assetDef.previewUrl
      });

      if (insertPreviewError) {
        throw new Error(`Unable to insert preview for "${assetDef.title}" (${identity.email}): ${insertPreviewError.message}`);
      }

      stats.previewsCreated += 1;
    }
  }

  return stats;
}

async function main() {
  loadEnv();

  const creatorCountArg = Number.parseInt(process.argv[2] ?? "", 10);
  const assetsPerCreatorArg = Number.parseInt(process.argv[3] ?? "", 10);
  const creatorCount = Number.isFinite(creatorCountArg) && creatorCountArg > 0 ? creatorCountArg : DEFAULT_CREATOR_COUNT;
  const assetsPerCreator =
    Number.isFinite(assetsPerCreatorArg) && assetsPerCreatorArg > 0 ? assetsPerCreatorArg : DEFAULT_ASSETS_PER_CREATOR;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) {
    requiredEnv("SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  console.log(`Seeding ${creatorCount} creators with ${assetsPerCreator} assets each...`);

  let createdUsers = 0;
  let existingUsers = 0;
  let assetsCreated = 0;
  let assetsExisting = 0;
  let previewsCreated = 0;

  for (let creatorIndex = 0; creatorIndex < creatorCount; creatorIndex += 1) {
    const identity = creatorIdentity(creatorIndex);
    const { user, created } = await ensureAuthUser(client, identity);
    if (created) {
      createdUsers += 1;
    } else {
      existingUsers += 1;
    }

    const stats = await ensureProfileAndAssets(client, user.id, identity, creatorIndex, assetsPerCreator);
    assetsCreated += stats.assetsCreated;
    assetsExisting += stats.assetsExisting;
    previewsCreated += stats.previewsCreated;

    if ((creatorIndex + 1) % 10 === 0 || creatorIndex === creatorCount - 1) {
      console.log(`Processed ${creatorIndex + 1}/${creatorCount} creators...`);
    }
  }

  console.log("");
  console.log("Seed complete.");
  console.log(`Users created:   ${createdUsers}`);
  console.log(`Users existing:  ${existingUsers}`);
  console.log(`Assets created:  ${assetsCreated}`);
  console.log(`Assets existing: ${assetsExisting}`);
  console.log(`Previews added:  ${previewsCreated}`);
  console.log("");
  console.log("Recommended pages to check:");
  console.log("- /creators");
  console.log("- /market");
  console.log("- /profile/<creator-id>");
}

main().catch((error) => {
  console.error("Seeding failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
