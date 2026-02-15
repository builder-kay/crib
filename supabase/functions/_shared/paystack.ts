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

export async function initializePaystackTransaction(
  secretKey: string,
  payload: {
    email: string;
    amount: number;
    currency: string;
    reference: string;
    callback_url: string;
    metadata: Record<string, unknown>;
  }
): Promise<PaystackInitializeResponse> {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paystack initialize failed: ${response.status} ${text}`);
  }

  return (await response.json()) as PaystackInitializeResponse;
}

export async function verifyPaystackTransaction(secretKey: string, reference: string): Promise<PaystackVerifyResponse> {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Paystack verify failed: ${response.status} ${text}`);
  }

  return (await response.json()) as PaystackVerifyResponse;
}