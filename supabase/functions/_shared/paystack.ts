function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

export async function computePaystackSignature(secret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return toHex(signature);
}

export async function verifyPaystackSignature(
  providedSignature: string | null,
  secret: string,
  rawBody: string
): Promise<boolean> {
  if (!providedSignature) {
    return false;
  }

  const expected = await computePaystackSignature(secret, rawBody);
  return timingSafeEqual(expected, providedSignature.trim().toLowerCase());
}

export type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

export type PaystackInitializePayload = {
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callback_url: string;
  metadata: Record<string, unknown>;
  subaccount?: string;
  transaction_charge?: number;
  bearer?: "account" | "subaccount";
};

export type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    amount: number;
    currency: string;
    status: string;
    reference: string;
    paid_at?: string;
    channel?: string;
    metadata?: Record<string, unknown>;
  };
};

export type PaystackSubaccountResponse = {
  status: boolean;
  message: string;
  data?: {
    subaccount_code: string;
    business_name?: string;
    settlement_bank?: string;
    account_number?: string;
    percentage_charge?: number;
    active?: boolean;
  };
};

export type PaystackBankListResponse = {
  status: boolean;
  message: string;
  data?: Array<{
    id?: number;
    name: string;
    slug?: string;
    code: string;
    longcode?: string;
    gateway?: string | null;
    pay_with_bank?: boolean;
    active?: boolean;
    country?: string;
    currency?: string;
    type?: string;
  }>;
};

export type PaystackResolveAccountResponse = {
  status: boolean;
  message: string;
  data?: {
    account_number: string;
    account_name: string;
    bank_id?: number;
  };
};

type ListPaystackBanksOptions = {
  country?: string;
  currency?: string;
  type?: "nuban" | "ghipss" | "mobile_money" | "basa";
  perPage?: number;
};

type PaystackSubaccountPayload = {
  business_name: string;
  bank_code: string;
  account_number: string;
  percentage_charge: number;
  description?: string;
  primary_contact_email?: string;
  active?: boolean;
};

async function paystackJsonRequest<T>(secretKey: string, url: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${secretKey}`);

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paystack request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

export async function initializePaystackTransaction(
  secretKey: string,
  payload: PaystackInitializePayload
): Promise<PaystackInitializeResponse> {
  return paystackJsonRequest<PaystackInitializeResponse>(secretKey, "https://api.paystack.co/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function verifyPaystackTransaction(secretKey: string, reference: string): Promise<PaystackVerifyResponse> {
  return paystackJsonRequest<PaystackVerifyResponse>(
    secretKey,
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: "GET"
    }
  );
}

export async function listPaystackBanks(
  secretKey: string,
  options: ListPaystackBanksOptions
): Promise<PaystackBankListResponse> {
  const search = new URLSearchParams();
  if (options.country) {
    search.set("country", options.country);
  }
  if (options.currency) {
    search.set("currency", options.currency);
  }
  if (options.type) {
    search.set("type", options.type);
  }
  search.set("perPage", String(options.perPage ?? 500));

  return paystackJsonRequest<PaystackBankListResponse>(
    secretKey,
    `https://api.paystack.co/bank?${search.toString()}`,
    {
      method: "GET"
    }
  );
}

export async function resolvePaystackAccountNumber(
  secretKey: string,
  accountNumber: string,
  bankCode: string
): Promise<PaystackResolveAccountResponse> {
  return paystackJsonRequest<PaystackResolveAccountResponse>(
    secretKey,
    `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    {
      method: "GET"
    }
  );
}

export async function createPaystackSubaccount(
  secretKey: string,
  payload: PaystackSubaccountPayload
): Promise<PaystackSubaccountResponse> {
  return paystackJsonRequest<PaystackSubaccountResponse>(secretKey, "https://api.paystack.co/subaccount", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updatePaystackSubaccount(
  secretKey: string,
  subaccountCode: string,
  payload: PaystackSubaccountPayload
): Promise<PaystackSubaccountResponse> {
  return paystackJsonRequest<PaystackSubaccountResponse>(
    secretKey,
    `https://api.paystack.co/subaccount/${encodeURIComponent(subaccountCode)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    }
  );
}
