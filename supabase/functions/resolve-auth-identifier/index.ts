import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { createServiceRoleClient, looksLikeEmail, lookupAuthIdentity, maskPhone, normalizeEmail, normalizePhone } from "../_shared/auth.ts";

type ResolveIdentifierPayload = {
  identifier?: string;
};

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: ResolveIdentifierPayload;
  try {
    body = (await request.json()) as ResolveIdentifierPayload;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  if (!identifier) {
    return jsonResponse({ error: "identifier is required" }, 400);
  }

  const email = looksLikeEmail(identifier) ? normalizeEmail(identifier) : null;
  const phone = email ? null : normalizePhone(identifier);

  if (!email && !phone) {
    return jsonResponse({ error: "Enter a valid email or mobile number with country code." }, 400);
  }

  try {
    const supabase = createServiceRoleClient();
    const identity = await lookupAuthIdentity(supabase, {
      phone: phone?.e164 ?? null,
      email
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

    return jsonResponse({
      ok: true,
      phone: identity.phone,
      email: identity.email,
      display_name: identity.display_name ?? "Creator",
      destination: maskPhone(identity.phone)
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to resolve account"
      },
      500
    );
  }
});
