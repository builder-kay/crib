import { verifyArkeselOtp } from "../_shared/arkesel.ts";
import {
  createServiceRoleClient,
  getArkeselSupportedCountryNames,
  isArkeselSupportedPhone,
  lookupAuthIdentity,
  normalizeEmail,
  normalizePhone
} from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type VerifyOtpPayload = {
  intent?: "register" | "reset";
  phone?: string;
  email?: string;
  code?: string;
  display_name?: string;
  password?: string;
  new_password?: string;
};

function verifyOtpStatus(code: string, message: string) {
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("expired")) {
    return 410;
  }

  if (code === "1104" || normalizedMessage.includes("invalid")) {
    return 400;
  }

  return 400;
}

function unsupportedOtpPhoneResponse() {
  const supportedCountries = getArkeselSupportedCountryNames();

  return jsonResponse(
    {
      error: `OTP verification currently supports ${supportedCountries.join(", ")} mobile numbers. Use Google or email instead.`,
      code: "unsupported_phone_country",
      supported_countries: supportedCountries,
      auth_fallback: "google_or_email"
    },
    400
  );
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

  let body: VerifyOtpPayload;
  try {
    body = (await request.json()) as VerifyOtpPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const intent = body.intent === "reset" ? "reset" : body.intent === "register" ? "register" : null;
  if (!intent) {
    return jsonResponse({ error: "intent must be register or reset" }, 400);
  }

  const normalizedPhone = normalizePhone(body.phone);
  if (!normalizedPhone) {
    return jsonResponse({ error: "Enter a valid mobile number with country code." }, 400);
  }

  if (!isArkeselSupportedPhone(normalizedPhone)) {
    return unsupportedOtpPhoneResponse();
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{4,8}$/.test(code)) {
    return jsonResponse({ error: "Enter the OTP code sent to your phone." }, 400);
  }

  try {
    const supabase = createServiceRoleClient();

    const { data: challenge, error: challengeError } = await supabase
      .from("auth_otp_challenges")
      .select("id, intent, normalized_phone, normalized_email, target_user_id, expires_at, consumed_at")
      .eq("intent", intent)
      .eq("normalized_phone", normalizedPhone.digits)
      .maybeSingle();

    if (challengeError) {
      return jsonResponse({ error: challengeError.message }, 500);
    }

    if (!challenge) {
      return jsonResponse(
        {
          error: "No active OTP request was found for this number. Request a new code and try again.",
          code: "otp_challenge_not_found"
        },
        404
      );
    }

    if (challenge.consumed_at) {
      return jsonResponse(
        {
          error: "This OTP has already been used. Request a new code and try again.",
          code: "otp_already_used"
        },
        409
      );
    }

    if (Date.parse(challenge.expires_at) <= Date.now()) {
      return jsonResponse(
        {
          error: "This OTP has expired. Request a new code and try again.",
          code: "otp_expired"
        },
        410
      );
    }

    const verifyResult = await verifyArkeselOtp({
      apiKey: arkeselApiKey,
      number: normalizedPhone.digits,
      code
    });

    if (!verifyResult.ok) {
      return jsonResponse(
        {
          error: verifyResult.message,
          code: verifyResult.code
        },
        verifyOtpStatus(verifyResult.code, verifyResult.message)
      );
    }

    if (intent === "register") {
      const displayName = typeof body.display_name === "string" ? body.display_name.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const normalizedEmail = normalizeEmail(body.email);

      if (displayName.length < 2) {
        return jsonResponse({ error: "Creative name must be at least 2 characters." }, 400);
      }

      if (password.length < 6) {
        return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
      }

      const existingIdentity = await lookupAuthIdentity(supabase, {
        phone: normalizedPhone.e164,
        email: normalizedEmail
      });

      if (existingIdentity) {
        return jsonResponse(
          {
            error: "An account already exists with that mobile number or email.",
            code: "account_exists"
          },
          409
        );
      }

      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        phone: normalizedPhone.e164,
        password,
        phone_confirm: true,
        user_metadata: {
          display_name: displayName,
          ...(normalizedEmail ? { contact_email: normalizedEmail } : {})
        }
      });

      if (createUserError || !createdUser.user) {
        return jsonResponse(
          {
            error: createUserError?.message ?? "Unable to create account"
          },
          500
        );
      }

      const { error: consumeError } = await supabase
        .from("auth_otp_challenges")
        .update({
          consumed_at: new Date().toISOString(),
          target_user_id: createdUser.user.id,
          normalized_email: normalizedEmail
        })
        .eq("id", challenge.id);

      if (consumeError) {
        return jsonResponse({ error: consumeError.message }, 500);
      }

      return jsonResponse({
        ok: true,
        intent: "register",
        phone: normalizedPhone.e164,
        email: normalizedEmail,
        user_id: createdUser.user.id
      });
    }

    const newPassword = typeof body.new_password === "string" ? body.new_password : "";
    if (newPassword.length < 6) {
      return jsonResponse({ error: "New password must be at least 6 characters." }, 400);
    }

    if (!challenge.target_user_id) {
      return jsonResponse(
        {
          error: "This reset request is incomplete. Request a new code and try again.",
          code: "reset_target_missing"
        },
        409
      );
    }

    const { error: updateUserError } = await supabase.auth.admin.updateUserById(challenge.target_user_id, {
      password: newPassword,
      phone_confirm: true
    });

    if (updateUserError) {
      return jsonResponse(
        {
          error: updateUserError.message
        },
        500
      );
    }

    const { error: consumeError } = await supabase
      .from("auth_otp_challenges")
      .update({
        consumed_at: new Date().toISOString()
      })
      .eq("id", challenge.id);

    if (consumeError) {
      return jsonResponse({ error: consumeError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      intent: "reset",
      phone: normalizedPhone.e164
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to verify OTP"
      },
      500
    );
  }
});
