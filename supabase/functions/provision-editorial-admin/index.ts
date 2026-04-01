import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createServiceRoleClient, lookupAuthIdentity, normalizeEmail, normalizePhone } from "../_shared/auth.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type ProvisionEditorialAdminPayload = {
  credential_type?: string;
  email?: string;
  phone?: string;
  password?: string;
  display_name?: string;
};

type AuthenticatedUser = {
  id: string;
};

async function authenticateUser(
  supabase: ReturnType<typeof createServiceRoleClient>,
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
      id: data.user.id
    },
    response: null
  };
}

function fallbackDisplayName(input: { displayName: string; email: string | null; phone: string | null }) {
  if (input.displayName) {
    return input.displayName;
  }

  if (input.email) {
    return input.email.split("@")[0] || "Editorial Editor";
  }

  if (input.phone) {
    return input.phone;
  }

  return "Editorial Editor";
}

Deno.serve(async (request) => {
  const corsResponse = handleCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabase = createServiceRoleClient();
    const authResult = await authenticateUser(supabase, request);
    if (authResult.response) {
      return authResult.response;
    }

    const user = authResult.user as AuthenticatedUser;

    const { data: requesterAdmin, error: requesterAdminError } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (requesterAdminError) {
      return jsonResponse({ error: requesterAdminError.message }, 500);
    }

    if (!requesterAdmin) {
      return jsonResponse({ error: "Only marketplace admins can provision editorial accounts." }, 403);
    }

    let body: ProvisionEditorialAdminPayload;
    try {
      body = (await request.json()) as ProvisionEditorialAdminPayload;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const credentialType = body.credential_type === "phone" ? "phone" : body.credential_type === "email" ? "email" : null;
    if (!credentialType) {
      return jsonResponse({ error: "credential_type must be email or phone" }, 400);
    }

    const normalizedEmail = credentialType === "email" ? normalizeEmail(body.email) : null;
    const normalizedPhone = credentialType === "phone" ? normalizePhone(body.phone) : null;
    const password = typeof body.password === "string" ? body.password : "";
    const requestedDisplayName = typeof body.display_name === "string" ? body.display_name.trim() : "";

    if (credentialType === "email" && !normalizedEmail) {
      return jsonResponse({ error: "Enter a valid editor email address." }, 400);
    }

    if (credentialType === "phone" && !normalizedPhone) {
      return jsonResponse({ error: "Enter a valid mobile number with country code." }, 400);
    }

    if (password.length < 6) {
      return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
    }

    const displayName = fallbackDisplayName({
      displayName: requestedDisplayName,
      email: normalizedEmail,
      phone: normalizedPhone?.e164 ?? null
    });

    const existingIdentity = await lookupAuthIdentity(supabase, {
      email: normalizedEmail,
      phone: normalizedPhone?.e164 ?? null
    });

    if (existingIdentity) {
      const { data: targetIsPlatformAdmin, error: targetPlatformAdminError } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", existingIdentity.user_id)
        .maybeSingle();

      if (targetPlatformAdminError) {
        return jsonResponse({ error: targetPlatformAdminError.message }, 500);
      }

      if (targetIsPlatformAdmin) {
        return jsonResponse(
          {
            error: "Use a separate account for editorial staff. This login already belongs to a marketplace admin.",
            code: "target_is_platform_admin"
          },
          409
        );
      }

      const updatePayload: {
        password: string;
        user_metadata: Record<string, unknown>;
        email?: string;
        email_confirm?: boolean;
        phone?: string;
        phone_confirm?: boolean;
      } = {
        password,
        user_metadata: {
          display_name: displayName
        }
      };

      if (normalizedEmail) {
        updatePayload.email = normalizedEmail;
        updatePayload.email_confirm = true;
      }

      if (normalizedPhone) {
        updatePayload.phone = normalizedPhone.e164;
        updatePayload.phone_confirm = true;
      }

      const { data: updatedUserData, error: updateUserError } = await supabase.auth.admin.updateUserById(existingIdentity.user_id, updatePayload);
      if (updateUserError || !updatedUserData.user) {
        return jsonResponse({ error: updateUserError?.message ?? "Unable to update editor account." }, 500);
      }

      const { error: profileUpsertError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: existingIdentity.user_id,
            display_name: displayName
          },
          { onConflict: "id" }
        );

      if (profileUpsertError) {
        return jsonResponse({ error: profileUpsertError.message }, 500);
      }

      const { error: roleUpsertError } = await supabase
        .from("editorial_admins")
        .upsert({ user_id: existingIdentity.user_id }, { onConflict: "user_id" });

      if (roleUpsertError) {
        return jsonResponse({ error: roleUpsertError.message }, 500);
      }

      return jsonResponse({
        ok: true,
        mode: "updated",
        user_id: existingIdentity.user_id,
        credential_type: credentialType,
        email: normalizedEmail,
        phone: normalizedPhone?.e164 ?? null,
        display_name: displayName
      });
    }

    const createPayload: {
      password: string;
      user_metadata: Record<string, unknown>;
      email?: string;
      email_confirm?: boolean;
      phone?: string;
      phone_confirm?: boolean;
    } = {
      password,
      user_metadata: {
        display_name: displayName
      }
    };

    if (normalizedEmail) {
      createPayload.email = normalizedEmail;
      createPayload.email_confirm = true;
    }

    if (normalizedPhone) {
      createPayload.phone = normalizedPhone.e164;
      createPayload.phone_confirm = true;
    }

    const { data: createdUserData, error: createUserError } = await supabase.auth.admin.createUser(createPayload);
    if (createUserError || !createdUserData.user) {
      return jsonResponse({ error: createUserError?.message ?? "Unable to create editor account." }, 500);
    }

    const { error: profileUpsertError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: createdUserData.user.id,
          display_name: displayName
        },
        { onConflict: "id" }
      );

    if (profileUpsertError) {
      return jsonResponse({ error: profileUpsertError.message }, 500);
    }

    const { error: roleInsertError } = await supabase
      .from("editorial_admins")
      .upsert({ user_id: createdUserData.user.id }, { onConflict: "user_id" });

    if (roleInsertError) {
      return jsonResponse({ error: roleInsertError.message }, 500);
    }

    return jsonResponse({
      ok: true,
      mode: "created",
      user_id: createdUserData.user.id,
      credential_type: credentialType,
      email: normalizedEmail,
      phone: normalizedPhone?.e164 ?? null,
      display_name: displayName
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to provision editorial account"
      },
      500
    );
  }
});
