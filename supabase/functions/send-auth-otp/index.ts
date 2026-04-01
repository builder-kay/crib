import { readArkeselOtpConfig, sendArkeselOtp } from "../_shared/arkesel.ts";
import { createServiceRoleClient, looksLikeEmail, lookupAuthIdentity, maskPhone, normalizeEmail, normalizePhone } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type SendOtpPayload = {
  intent?: "register" | "reset";
  phone?: string;
  email?: string;
  identifier?: string;
};

function otpSendStatus(code: string, message: string) {
  const normalizedMessage = message.toLowerCase();
  if (code === "1005" || normalizedMessage.includes("invalid")) {
    return 400;
  }

  return 502;
}

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const arkeselApiKey = Deno.env.get("ARKESEL_API_KEY");

  if (!arkeselApiKey) {
    return jsonResponse({ error: "Missing ARKESEL_API_KEY environment variable" }, 500);
  }

  let arkeselConfig;
  try {
    arkeselConfig = readArkeselOtpConfig();
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Invalid Arkesel OTP configuration" }, 500);
  }

  let body: SendOtpPayload;
  try {
    body = (await request.json()) as SendOtpPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const intent = body.intent === "reset" ? "reset" : body.intent === "register" ? "register" : null;
  if (!intent) {
    return jsonResponse({ error: "intent must be register or reset" }, 400);
  }

  try {
    const supabase = createServiceRoleClient();

    if (intent === "register") {
      const normalizedPhone = normalizePhone(body.phone);
      const normalizedEmail = normalizeEmail(body.email);

      if (!normalizedPhone) {
        return jsonResponse({ error: "Enter a valid mobile number with country code." }, 400);
      }

      const existingIdentity = await lookupAuthIdentity(supabase, {
        phone: normalizedPhone.e164,
        email: normalizedEmail
      });

      if (existingIdentity) {
        return jsonResponse(
          {
            error: "An account already exists with that mobile number or email.",
            code: "account_exists",
            can_sign_in: true,
            can_reset: true,
            destination: maskPhone(existingIdentity.phone)
          },
          409
        );
      }

      const sendResult = await sendArkeselOtp({
        apiKey: arkeselApiKey,
        senderId: arkeselConfig.senderId,
        number: normalizedPhone.digits,
        message: arkeselConfig.registerMessage,
        expiry: arkeselConfig.expiry,
        length: arkeselConfig.length,
        medium: arkeselConfig.medium,
        type: arkeselConfig.type
      });

      if (!sendResult.ok) {
        return jsonResponse(
          {
            error: sendResult.message,
            code: sendResult.code
          },
          otpSendStatus(sendResult.code, sendResult.message)
        );
      }

      const expiresAt = new Date(Date.now() + arkeselConfig.expiry * 60 * 1000).toISOString();
      const { error: challengeError } = await supabase.from("auth_otp_challenges").upsert(
        {
          intent: "register",
          normalized_phone: normalizedPhone.digits,
          normalized_email: normalizedEmail,
          target_user_id: null,
          expires_at: expiresAt,
          consumed_at: null
        },
        { onConflict: "intent,normalized_phone" }
      );

      if (challengeError) {
        return jsonResponse({ error: challengeError.message }, 500);
      }

      return jsonResponse({
        ok: true,
        intent: "register",
        destination: maskPhone(normalizedPhone.e164),
        phone: normalizedPhone.e164,
        expires_in_seconds: arkeselConfig.expiry * 60
      });
    }

    const rawIdentifier = typeof body.identifier === "string"
      ? body.identifier.trim()
      : typeof body.phone === "string"
        ? body.phone.trim()
        : typeof body.email === "string"
          ? body.email.trim()
          : "";

    if (!rawIdentifier) {
      return jsonResponse({ error: "Provide the mobile number or email tied to the account." }, 400);
    }

    const normalizedEmail = looksLikeEmail(rawIdentifier) ? normalizeEmail(rawIdentifier) : normalizeEmail(body.email);
    const normalizedPhone = normalizedEmail ? normalizePhone(body.phone) : normalizePhone(rawIdentifier);

    if (!normalizedEmail && !normalizedPhone) {
      return jsonResponse({ error: "Enter a valid mobile number or email." }, 400);
    }

    const identity = await lookupAuthIdentity(supabase, {
      phone: normalizedPhone?.e164 ?? null,
      email: normalizedEmail
    });

    if (!identity) {
      return jsonResponse(
        {
          error: "No account found for that mobile number or email.",
          code: "account_not_found"
        },
        404
      );
    }

    const identityPhone = normalizePhone(identity.phone ?? "");
    if (!identityPhone) {
      return jsonResponse(
        {
          error: "This account does not have a mobile number linked for OTP reset yet.",
          code: "missing_mobile_number"
        },
        409
      );
    }

    const sendResult = await sendArkeselOtp({
      apiKey: arkeselApiKey,
      senderId: arkeselConfig.senderId,
      number: identityPhone.digits,
      message: arkeselConfig.resetMessage,
      expiry: arkeselConfig.expiry,
      length: arkeselConfig.length,
      medium: arkeselConfig.medium,
      type: arkeselConfig.type
    });

    if (!sendResult.ok) {
      return jsonResponse(
        {
          error: sendResult.message,
          code: sendResult.code
        },
        otpSendStatus(sendResult.code, sendResult.message)
      );
    }

    const expiresAt = new Date(Date.now() + arkeselConfig.expiry * 60 * 1000).toISOString();
    const { error: challengeError } = await supabase.from("auth_otp_challenges").upsert(
      {
        intent: "reset",
        normalized_phone: identityPhone.digits,
        normalized_email: identity.email,
        target_user_id: identity.user_id,
        expires_at: expiresAt,
        consumed_at: null
      },
      { onConflict: "intent,normalized_phone" }
    );

    if (challengeError) {
      return jsonResponse({ error: challengeError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      intent: "reset",
      destination: maskPhone(identityPhone.e164),
      phone: identityPhone.e164,
      expires_in_seconds: arkeselConfig.expiry * 60
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to send OTP"
      },
      500
    );
  }
});
