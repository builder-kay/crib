type ArkeselApiResult = {
  ok: boolean;
  code: string;
  message: string;
  raw: unknown;
};

export type ArkeselOtpMedium = "sms" | "voice";
export type ArkeselOtpType = "numeric" | "alphanumeric";

export type ArkeselOtpConfig = {
  senderId: string;
  expiry: number;
  length: number;
  medium: ArkeselOtpMedium;
  type: ArkeselOtpType;
  registerMessage: string;
  resetMessage: string;
};

const ARKESEL_BASE_URL = "https://sms.arkesel.com/api/otp";

function readBoundedInteger(value: string | undefined, fallback: number, min: number, max: number, envKey: string) {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${envKey} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

function readEnumValue<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, envKey: string): T {
  if (!value?.trim()) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase() as T;
  if (!allowed.includes(normalized)) {
    throw new Error(`${envKey} must be one of: ${allowed.join(", ")}.`);
  }

  return normalized;
}

function readMessageTemplate(value: string | undefined, fallback: string, envKey: string) {
  const message = value?.trim() || fallback;
  if (!message.includes("%otp_code%")) {
    throw new Error(`${envKey} must include the %otp_code% placeholder.`);
  }

  return message;
}

export function readArkeselOtpConfig(): ArkeselOtpConfig {
  const senderId = Deno.env.get("ARKESEL_SENDER_ID")?.trim() || "CRIB";
  if (senderId.length > 11) {
    throw new Error("ARKESEL_SENDER_ID must be 11 characters or fewer.");
  }

  return {
    senderId,
    expiry: readBoundedInteger(Deno.env.get("ARKESEL_OTP_EXPIRY_MINUTES"), 10, 1, 10, "ARKESEL_OTP_EXPIRY_MINUTES"),
    length: readBoundedInteger(Deno.env.get("ARKESEL_OTP_LENGTH"), 6, 6, 15, "ARKESEL_OTP_LENGTH"),
    medium: readEnumValue(Deno.env.get("ARKESEL_OTP_MEDIUM"), ["sms", "voice"], "sms", "ARKESEL_OTP_MEDIUM"),
    type: readEnumValue(Deno.env.get("ARKESEL_OTP_TYPE"), ["numeric", "alphanumeric"], "numeric", "ARKESEL_OTP_TYPE"),
    registerMessage: readMessageTemplate(
      Deno.env.get("ARKESEL_REGISTER_OTP_MESSAGE"),
      "Your CRIB verification code is %otp_code%. It expires in %expiry% minutes.",
      "ARKESEL_REGISTER_OTP_MESSAGE"
    ),
    resetMessage: readMessageTemplate(
      Deno.env.get("ARKESEL_RESET_OTP_MESSAGE"),
      "Your CRIB password reset code is %otp_code%. It expires in %expiry% minutes.",
      "ARKESEL_RESET_OTP_MESSAGE"
    )
  };
}

async function parseArkeselResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readMessage(payload: Record<string, unknown>, fallback: string) {
  const direct = payload.message;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const nestedData = payload.data;
  if (nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)) {
    const nestedMessage = (nestedData as Record<string, unknown>).message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) {
      return nestedMessage.trim();
    }
  }

  return fallback;
}

export async function sendArkeselOtp(input: {
  apiKey: string;
  senderId: string;
  number: string;
  message: string;
  expiry?: number;
  length?: number;
  medium?: "sms" | "voice";
  type?: "numeric" | "alphanumeric";
}): Promise<ArkeselApiResult> {
  const response = await fetch(`${ARKESEL_BASE_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": input.apiKey
    },
    body: JSON.stringify({
      expiry: input.expiry ?? 10,
      length: input.length ?? 6,
      medium: input.medium ?? "sms",
      type: input.type ?? "numeric",
      sender_id: input.senderId,
      number: input.number,
      message: input.message
    })
  });

  const payload = await parseArkeselResponse(response);
  const code = String(payload.code ?? response.status);
  const ok = response.ok && code === "1000";
  const message = readMessage(payload, ok ? "OTP sent" : "Could not send OTP");

  return {
    ok,
    code,
    message,
    raw: payload
  };
}

export async function verifyArkeselOtp(input: {
  apiKey: string;
  number: string;
  code: string;
}): Promise<ArkeselApiResult> {
  const response = await fetch(`${ARKESEL_BASE_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": input.apiKey
    },
    body: JSON.stringify({
      number: input.number,
      code: input.code
    })
  });

  const payload = await parseArkeselResponse(response);
  const code = String(payload.code ?? response.status);
  const ok = response.ok && code === "1100";
  const message = readMessage(payload, ok ? "OTP verified" : "OTP verification failed");

  return {
    ok,
    code,
    message,
    raw: payload
  };
}
