import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = process.cwd();
const SOURCE_DOMAIN = "@crib.local";
const TARGET_DOMAIN = "@cribstress.com";

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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let page = 1;
  const perPage = 200;
  let scanned = 0;
  let updated = 0;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw new Error(`Unable to list auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      scanned += 1;
      const email = (user.email ?? "").toLowerCase();
      if (!email.endsWith(SOURCE_DOMAIN)) {
        continue;
      }

      const nextEmail = `${email.slice(0, -SOURCE_DOMAIN.length)}${TARGET_DOMAIN}`;
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        email: nextEmail,
        email_confirm: true
      });

      if (updateError) {
        throw new Error(`Failed to update ${email} -> ${nextEmail}: ${updateError.message}`);
      }

      updated += 1;
      console.log(`Updated: ${email} -> ${nextEmail}`);
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  console.log("");
  console.log("Email migration complete.");
  console.log(`Users scanned:  ${scanned}`);
  console.log(`Users updated:  ${updated}`);
  console.log(`Source domain:  ${SOURCE_DOMAIN}`);
  console.log(`Target domain:  ${TARGET_DOMAIN}`);
}

main().catch((error) => {
  console.error("Migration failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
