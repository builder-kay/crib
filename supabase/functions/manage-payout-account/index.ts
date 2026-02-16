import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  createPaystackSubaccount,
  listPaystackBanks,
  resolvePaystackAccountNumber,
  updatePaystackSubaccount
} from "../_shared/paystack.ts";

type PayoutAccountRow = {
  creator_id: string;
  provider: "paystack";
  status: "active" | "inactive";
  payout_type: "bank" | "mobile_money";
  country: string;
  business_name: string;
  subaccount_code: string;
  settlement_bank_code: string;
  settlement_bank_name: string | null;
  account_number_last4: string;
  account_name: string | null;
  updated_at: string;
};

type UpsertPayoutPayload = {
  payout_type?: string;
  business_name?: string;
  account_number?: string;
  settlement_bank_code?: string;
  settlement_bank_name?: string;
  country?: string;
};

type PayoutMethod = "bank" | "mobile_money";
type PayoutOptions = {
  banks: Array<{ code: string; name: string }>;
  mobileMoneyProviders: Array<{ code: string; name: string }>;
};

type AuthenticatedUser = {
  id: string;
  email: string | null;
};

function parseCommissionBps(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1000", 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 1000;
  }
  return Math.min(parsed, 10_000);
}

function normalizeCountry(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || fallback;
}

function parsePayoutType(value: unknown): PayoutMethod {
  if (typeof value !== "string") {
    return "bank";
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "mobile_money" ? "mobile_money" : "bank";
}

function countryToCurrency(country: string): string | null {
  switch (country) {
    case "ghana":
      return "GHS";
    case "nigeria":
      return "NGN";
    case "kenya":
      return "KES";
    case "south africa":
      return "ZAR";
    default:
      return null;
  }
}

function sanitizeBankCode(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function sanitizeAccountNumber(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\D+/g, "");
}

function parseBusinessName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mobileMoneyProviderPriority(name: string): number {
  const normalized = normalizeLookup(name);

  if (normalized.includes("mtn")) {
    return 0;
  }

  if (normalized.includes("telecel") || normalized.includes("vodafone")) {
    return 1;
  }

  if (normalized.includes("airteltigo") || normalized.includes("tigoairtel") || normalized.includes("atmoney")) {
    return 2;
  }

  return 100;
}

function shouldReplaceSubaccountFromError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  return message.includes("404") || message.includes("not found");
}

function payoutSetupErrorDetails(error: unknown, payoutType: PayoutMethod): string {
  const base = error instanceof Error ? error.message : "Unknown error";
  if (payoutType !== "mobile_money") {
    return base;
  }

  return `${base}. Mobile money payouts depend on Paystack support for the selected country/provider.`;
}

async function authenticateUser(
  supabase: ReturnType<typeof createClient>,
  request: Request
): Promise<{ user: AuthenticatedUser | null; response: Response | null }> {
  const authorization = request.headers.get("Authorization");
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!accessToken) {
    return {
      user: null,
      response: jsonResponse({ error: "Authentication required" }, 401)
    };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return {
      user: null,
      response: jsonResponse({ error: "Invalid authentication token" }, 401)
    };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null
    },
    response: null
  };
}

function mapPayoutAccountRow(row: PayoutAccountRow | null) {
  if (!row) {
    return null;
  }

  return {
    provider: row.provider,
    status: row.status,
    payout_type: row.payout_type,
    country: row.country,
    business_name: row.business_name,
    subaccount_code: row.subaccount_code,
    settlement_bank_code: row.settlement_bank_code,
    settlement_bank_name: row.settlement_bank_name,
    account_number_last4: row.account_number_last4,
    account_name: row.account_name,
    updated_at: row.updated_at
  };
}

async function loadPayoutOptions(
  paystackSecretKey: string,
  country: string
): Promise<PayoutOptions> {
  const currency = countryToCurrency(country);

  let banksResponse;
  try {
    banksResponse = await listPaystackBanks(paystackSecretKey, { country });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unable to load banks");
  }

  if (!banksResponse.status) {
    throw new Error(banksResponse.message || "Unable to load banks");
  }

  const banks = (banksResponse.data ?? [])
    .filter((bank) => bank.active !== false && Boolean(bank.code) && Boolean(bank.name) && bank.type !== "mobile_money")
    .map((bank) => ({ code: bank.code, name: bank.name }))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (!currency) {
    return {
      banks,
      mobileMoneyProviders: []
    };
  }

  let mobileMoneyResponse;
  try {
    mobileMoneyResponse = await listPaystackBanks(paystackSecretKey, {
      currency,
      type: "mobile_money"
    });
  } catch {
    return {
      banks,
      mobileMoneyProviders: []
    };
  }

  if (!mobileMoneyResponse.status) {
    return {
      banks,
      mobileMoneyProviders: []
    };
  }

  const mobileMoneyProviders = (mobileMoneyResponse.data ?? [])
    .filter((provider) => provider.active !== false && Boolean(provider.code) && Boolean(provider.name))
    .map((provider) => ({ code: provider.code, name: provider.name }))
    .sort((left, right) => {
      const priorityDiff = mobileMoneyProviderPriority(left.name) - mobileMoneyProviderPriority(right.name);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return left.name.localeCompare(right.name);
    });

  return {
    banks,
    mobileMoneyProviders
  };
}

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  const commissionBps = parseCommissionBps(Deno.env.get("COMMISSION_BPS"));
  const defaultCountry = normalizeCountry(Deno.env.get("PAYSTACK_PAYOUT_COUNTRY"), "ghana");

  if (!supabaseUrl || !serviceRoleKey || !paystackSecretKey) {
    return jsonResponse({ error: "Missing required environment variables" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const authResult = await authenticateUser(supabase, request);
  if (authResult.response) {
    return authResult.response;
  }

  const user = authResult.user as AuthenticatedUser;

  if (request.method === "GET") {
    const url = new URL(request.url);
    const country = normalizeCountry(url.searchParams.get("country"), defaultCountry);

    const { data: payoutAccountData, error: payoutAccountError } = await supabase
      .from("creator_payout_accounts")
      .select(
        "creator_id, provider, status, payout_type, country, business_name, subaccount_code, settlement_bank_code, settlement_bank_name, account_number_last4, account_name, updated_at"
      )
      .eq("creator_id", user.id)
      .maybeSingle();

    if (payoutAccountError) {
      return jsonResponse({ error: "Unable to load payout account", details: payoutAccountError.message }, 500);
    }

    let options: PayoutOptions;
    try {
      options = await loadPayoutOptions(paystackSecretKey, country);
    } catch (error) {
      return jsonResponse(
        {
          error: "Unable to load payout options",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        502
      );
    }

    return jsonResponse({
      country,
      account: mapPayoutAccountRow((payoutAccountData as PayoutAccountRow | null) ?? null),
      banks: options.banks,
      mobile_money_providers: options.mobileMoneyProviders
    });
  }

  let body: UpsertPayoutPayload;
  try {
    body = (await request.json()) as UpsertPayoutPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const payoutType = parsePayoutType(body.payout_type);
  const country = normalizeCountry(body.country, defaultCountry);
  const businessName = parseBusinessName(body.business_name);
  const bankCode = sanitizeBankCode(body.settlement_bank_code);
  const accountNumber = sanitizeAccountNumber(body.account_number);

  if (businessName.length < 2 || businessName.length > 120) {
    return jsonResponse({ error: "business_name must be between 2 and 120 characters" }, 400);
  }

  if (!bankCode || bankCode.length > 20) {
    return jsonResponse({ error: "settlement_bank_code is required" }, 400);
  }

  const minDigits = payoutType === "mobile_money" ? 8 : 6;
  if (!accountNumber || accountNumber.length < minDigits || accountNumber.length > 20) {
    return jsonResponse({ error: `account_number must contain ${minDigits} to 20 digits` }, 400);
  }

  let options: PayoutOptions;
  try {
    options = await loadPayoutOptions(paystackSecretKey, country);
  } catch (error) {
    return jsonResponse(
      {
        error: "Unable to load payout options",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      502
    );
  }

  const availableOptions = payoutType === "mobile_money" ? options.mobileMoneyProviders : options.banks;
  const selectedOption = availableOptions.find((option) => option.code === bankCode);
  if (!selectedOption) {
    return jsonResponse(
      {
        error:
          payoutType === "mobile_money"
            ? "Selected mobile money provider is not available for this country/currency"
            : "Selected bank is not available for this country"
      },
      400
    );
  }

  let resolvedAccount;
  try {
    resolvedAccount = await resolvePaystackAccountNumber(paystackSecretKey, accountNumber, bankCode);
  } catch (error) {
    return jsonResponse(
      {
        error: payoutType === "mobile_money" ? "Unable to verify mobile money account details" : "Unable to resolve account details",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      502
    );
  }

  if (!resolvedAccount.status || !resolvedAccount.data?.account_name) {
    return jsonResponse(
      {
        error:
          payoutType === "mobile_money"
            ? resolvedAccount.message || "Could not verify mobile money account name"
            : resolvedAccount.message || "Invalid account details supplied"
      },
      400
    );
  }

  const accountName = resolvedAccount.data.account_name.trim();

  const { data: existingAccount, error: existingAccountError } = await supabase
    .from("creator_payout_accounts")
    .select("subaccount_code")
    .eq("creator_id", user.id)
    .maybeSingle();

  if (existingAccountError) {
    return jsonResponse({ error: "Unable to load existing payout account", details: existingAccountError.message }, 500);
  }

  const subaccountPayload = {
    business_name: businessName,
    bank_code: bankCode,
    account_number: accountNumber,
    percentage_charge: Number((commissionBps / 100).toFixed(2)),
    description: `CRIB creator payout (${user.id})`,
    primary_contact_email: user.email ?? undefined,
    active: true
  };

  let subaccountResponse;

  if (existingAccount?.subaccount_code) {
    try {
      subaccountResponse = await updatePaystackSubaccount(paystackSecretKey, existingAccount.subaccount_code, subaccountPayload);
    } catch (error) {
      if (!shouldReplaceSubaccountFromError(error)) {
        return jsonResponse(
          {
            error: "Unable to update existing payout account",
            details: payoutSetupErrorDetails(error, payoutType)
          },
          502
        );
      }
    }
  }

  if (!subaccountResponse) {
    try {
      subaccountResponse = await createPaystackSubaccount(paystackSecretKey, subaccountPayload);
    } catch (error) {
      return jsonResponse(
        {
          error: "Unable to create payout account",
          details: payoutSetupErrorDetails(error, payoutType)
        },
        502
      );
    }
  }

  if (!subaccountResponse.status || !subaccountResponse.data?.subaccount_code) {
    return jsonResponse({ error: subaccountResponse.message || "Failed to configure payout account" }, 502);
  }

  const bankNameInput = typeof body.settlement_bank_name === "string" ? body.settlement_bank_name.trim() : "";
  const settlementBankName = bankNameInput || selectedOption.name;

  const { data: upsertedAccount, error: upsertError } = await supabase
    .from("creator_payout_accounts")
    .upsert(
      {
        creator_id: user.id,
        provider: "paystack",
        status: "active",
        payout_type: payoutType,
        country,
        business_name: businessName,
        subaccount_code: subaccountResponse.data.subaccount_code,
        settlement_bank_code: bankCode,
        settlement_bank_name: settlementBankName || null,
        account_number_last4: accountNumber.slice(-4),
        account_name: accountName,
        metadata: {
          commission_bps: commissionBps
        }
      },
      { onConflict: "creator_id" }
    )
    .select(
      "creator_id, provider, status, payout_type, country, business_name, subaccount_code, settlement_bank_code, settlement_bank_name, account_number_last4, account_name, updated_at"
    )
    .single();

  if (upsertError || !upsertedAccount) {
    return jsonResponse({ error: "Unable to save payout account", details: upsertError?.message }, 500);
  }

  return jsonResponse({
    ok: true,
    account: mapPayoutAccountRow(upsertedAccount as PayoutAccountRow)
  });
});
