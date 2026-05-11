import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/Toast";
import {
  ARKESEL_SUPPORTED_COUNTRIES,
  ARKESEL_SUPPORTED_COUNTRY_NAMES,
  composeArkeselPhoneInput,
  getUserContactEmail,
  isArkeselSupportedPhoneInput,
  maskPhoneNumber,
  normalizeAuthPhoneInput
} from "@/lib/auth";
import { sendAuthOtp, signInWithGoogle, signInWithIdentifier, verifyAuthOtp } from "@/lib/api";
import { sanitizeAppRedirectPath } from "@/lib/navigation";
import {
  authLoginSchema,
  authOtpCodeSchema,
  authRegisterSchema,
  authResetRequestSchema,
  authResetVerifySchema
} from "@/lib/validators/auth";
import { useAuthStore } from "@/store/authStore";

const heroStats = [
  { label: "Payments", value: "Paystack-powered", detail: "Get paid fast from every sale." },
  { label: "Downloads", value: "Always protected", detail: "Secure links keep buyer downloads safe." },
  { label: "Your workspace", value: "One place", detail: "Manage uploads, sales, and buyers here." },
  { label: "Sign in", value: "Mobile-first", detail: "Quick, secure login with your phone." }
];

const editorialHeroStats = [
  { label: "Blog desk", value: "Story workflow", detail: "Write, edit, and manage stories from one focused workspace." },
  { label: "Access model", value: "Editor-only logins", detail: "Blog accounts are provisioned separately from platform admins." },
  { label: "Publishing pace", value: "Draft to spotlight", detail: "Track updates and feature the strongest stories quickly." },
  { label: "Account recovery", value: "OTP reset ready", detail: "Editors can still recover access with the same secure auth system." }
];

type AuthMode = "login" | "register" | "reset";

type ExistingAccountHint = {
  identifier: string;
  destination: string;
};

export function AuthPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEditorialLogin = location.pathname === "/editorial-login";
  const redirectTo = sanitizeAppRedirectPath(
    searchParams.get("redirect"),
    isEditorialLogin ? "/editorial-admin" : "/market"
  );

  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const [mode, setMode] = useState<AuthMode>("login");
  const [modeDirection, setModeDirection] = useState<"to-login" | "to-register">("to-register");

  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerStep, setRegisterStep] = useState<"details" | "verify">("details");
  const [registerDisplayName, setRegisterDisplayName] = useState("");
  const [registerCountryCode, setRegisterCountryCode] = useState(ARKESEL_SUPPORTED_COUNTRIES[0]?.dialCode ?? "+233");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerOtpCode, setRegisterOtpCode] = useState("");
  const [registerResolvedPhone, setRegisterResolvedPhone] = useState("");
  const [registerDestination, setRegisterDestination] = useState("");
  const [existingAccountHint, setExistingAccountHint] = useState<ExistingAccountHint | null>(null);

  const [resetStep, setResetStep] = useState<"details" | "verify">("details");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetOtpCode, setResetOtpCode] = useState("");
  const [resetResolvedPhone, setResetResolvedPhone] = useState("");
  const [resetDestination, setResetDestination] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const oauthErrorRef = useRef<string | null>(null);
  const oauthCallbackHandledRef = useRef(false);

  const currentUserEmail = getUserContactEmail(user);
  const isOAuthCallback = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return ["code", "access_token", "refresh_token", "provider_token", "provider_refresh_token"].some((key) => params.has(key));
  }, [location.search]);
  const oauthErrorMessage = useMemo(() => {
    const value = searchParams.get("error_description") ?? searchParams.get("error");
    return value ? decodeURIComponent(value.replace(/\+/g, " ")) : null;
  }, [searchParams]);

  const formHeadline = useMemo(() => {
    if (isEditorialLogin) {
      return mode === "reset" ? (resetStep === "verify" ? "Enter your reset code" : "Reset editor access") : "Blog sign in";
    }

    if (mode === "register") {
      return registerStep === "verify" ? "Verify your mobile number" : "Create your account";
    }

    if (mode === "reset") {
      return resetStep === "verify" ? "Enter your reset code" : "Reset your password";
    }

    return "Welcome back";
  }, [isEditorialLogin, mode, registerStep, resetStep]);

  const formHint = useMemo(() => {
    if (isEditorialLogin) {
      return mode === "reset"
        ? resetStep === "verify"
          ? `We sent a code to ${resetDestination || "your phone"}. Enter it to set a new password.`
          : "Enter the phone or email for your editor account to reset your password."
        : "Sign in with your editor account.";
    }

    if (mode === "register") {
      return registerStep === "verify"
        ? `Confirm the code we sent to ${registerDestination || "your phone"} to finish creating your account.`
        : "";
    }

    if (mode === "reset") {
      return resetStep === "verify"
        ? `We sent a code to ${resetDestination || "your phone"}. Enter it to set a new password.`
        : "Enter the phone or email linked to your account to reset your password.";
    }

    return "";
  }, [isEditorialLogin, mode, registerDestination, registerStep, resetDestination, resetStep]);

  const heroTitle = useMemo(() => {
    if (isEditorialLogin) {
      return "Editor workspace.";
    }

    if (mode === "register") {
      return "Start selling your work.";
    }

    if (mode === "reset") {
      return "Reset your password.";
    }

    return "Welcome back.";
  }, [isEditorialLogin, mode]);

  const heroCopy = useMemo(() => {
    if (isEditorialLogin) {
      return "Use your dedicated editor login to access story publishing, updates, and spotlight management without platform-admin permissions.";
    }

    if (mode === "register") {
      return "Create your account with one text, then start selling your assets, beats, and designs.";
    }

    if (mode === "reset") {
      return "Confirm your phone, set a new password, and get back to selling.";
    }

    return "Get back to your uploads, orders, and sales.";
  }, [isEditorialLogin, mode]);

  const activeHeroStats = isEditorialLogin ? editorialHeroStats : heroStats;

  const registerPasswordStrength = useMemo(() => evaluatePasswordStrength(registerPassword), [registerPassword]);
  const registerConfirmMismatch = registerStep === "details" && registerConfirmPassword.length > 0 && registerPassword !== registerConfirmPassword;
  const resetPasswordStrength = useMemo(() => evaluatePasswordStrength(resetNewPassword), [resetNewPassword]);
  const selectedRegisterCountry = useMemo(
    () => ARKESEL_SUPPORTED_COUNTRIES.find((country) => country.dialCode === registerCountryCode) ?? ARKESEL_SUPPORTED_COUNTRIES[0],
    [registerCountryCode]
  );
  const modeAnimationClass = modeDirection === "to-register" ? "auth-mode-enter-forward" : "auth-mode-enter-back";
  const canUseGoogleAuth = !isEditorialLogin && (mode === "login" || (mode === "register" && registerStep === "details"));
  const supportedCountryCopy = useMemo(() => ARKESEL_SUPPORTED_COUNTRY_NAMES.join(", "), []);

  useEffect(() => {
    if (!oauthErrorMessage || oauthErrorRef.current === oauthErrorMessage) {
      return;
    }

    oauthErrorRef.current = oauthErrorMessage;
    pushToast(oauthErrorMessage, "error");
  }, [oauthErrorMessage, pushToast]);

  useEffect(() => {
    if (!user || !isOAuthCallback || oauthCallbackHandledRef.current) {
      return;
    }

    oauthCallbackHandledRef.current = true;
    navigate(redirectTo, { replace: true });
  }, [isOAuthCallback, navigate, redirectTo, user]);

  function resetRegisterVerificationState() {
    setRegisterStep("details");
    setRegisterOtpCode("");
    setRegisterResolvedPhone("");
    setRegisterDestination("");
  }

  function resetResetVerificationState() {
    setResetStep("details");
    setResetOtpCode("");
    setResetResolvedPhone("");
    setResetDestination("");
  }

  function handleModeChange(nextMode: AuthMode) {
    if (isEditorialLogin && nextMode === "register") {
      return;
    }

    if (nextMode === mode) {
      return;
    }

    setModeDirection(nextMode === "register" ? "to-register" : "to-login");
    setMode(nextMode);

    if (nextMode !== "register") {
      setExistingAccountHint(null);
    }

    if (nextMode === "login") {
      resetResetVerificationState();
    }
  }

  function unsupportedOtpPhoneMessage(context: "register" | "reset") {
    return context === "register"
      ? `OTP sign-up currently supports ${supportedCountryCopy} mobile numbers. Use Google or email instead.`
      : `OTP reset currently supports ${supportedCountryCopy} mobile numbers. Use Google or email instead.`;
  }

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = authLoginSchema.safeParse({
      identifier: loginIdentifier.trim(),
      password: loginPassword
    });

    if (!parsed.success) {
      pushToast(parsed.error.issues[0]?.message ?? "Invalid login details", "error");
      return;
    }

    setSubmitting(true);
    try {
      const authResult = await signInWithIdentifier(parsed.data.identifier, parsed.data.password);
      if (authResult.session) {
        setSession(authResult.session);
      }
      pushToast("Welcome back", "success");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Authentication failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestRegisterOtp() {
    if (registerPassword !== registerConfirmPassword) {
      pushToast("Confirm password does not match", "error");
      return;
    }

    const parsed = authRegisterSchema.safeParse({
      display_name: registerDisplayName.trim(),
      phone: registerPhone.trim(),
      email: registerEmail.trim(),
      password: registerPassword
    });

    if (!parsed.success) {
      pushToast(parsed.error.issues[0]?.message ?? "Invalid sign up details", "error");
      return;
    }

    const normalizedPhone = composeArkeselPhoneInput(registerCountryCode, parsed.data.phone);
    if (!normalizedPhone) {
      const directPhoneCandidate = normalizeAuthPhoneInput(parsed.data.phone);
      if (directPhoneCandidate && !isArkeselSupportedPhoneInput(directPhoneCandidate)) {
        pushToast(unsupportedOtpPhoneMessage("register"), "info");
        return;
      }

      pushToast("Choose a supported country code and enter a valid mobile number.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = await sendAuthOtp({
        intent: "register",
        phone: normalizedPhone,
        ...(parsed.data.email ? { email: parsed.data.email } : {})
      });

      setRegisterResolvedPhone(payload.phone);
      setRegisterDestination(payload.destination);
      setRegisterStep("verify");
      setRegisterOtpCode("");
      setExistingAccountHint(null);
      pushToast(`OTP sent to ${payload.destination}`, "success");
    } catch (error) {
      const authError = error as Error & {
        code?: string;
        payload?: Record<string, unknown>;
      };

      if (authError.code === "account_exists") {
        const fallbackIdentifier = registerEmail.trim() || normalizedPhone;
        const destination =
          typeof authError.payload?.destination === "string" ? authError.payload.destination : maskPhoneNumber(normalizedPhone);
        setExistingAccountHint({
          identifier: fallbackIdentifier,
          destination
        });
        pushToast("Account already exists. Sign in instead or send a reset OTP.", "info");
        return;
      }

      if (authError.code === "unsupported_phone_country") {
        pushToast(authError.message || unsupportedOtpPhoneMessage("register"), "info");
        return;
      }

      pushToast(authError.message || "Could not send OTP", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeRegister() {
    if (registerPassword !== registerConfirmPassword) {
      pushToast("Confirm password does not match", "error");
      return;
    }

    const codeParsed = authOtpCodeSchema.safeParse({ code: registerOtpCode });
    if (!codeParsed.success) {
      pushToast(codeParsed.error.issues[0]?.message ?? "Invalid OTP code", "error");
      return;
    }

    const payloadParsed = authRegisterSchema.safeParse({
      display_name: registerDisplayName.trim(),
      phone: registerPhone.trim(),
      email: registerEmail.trim(),
      password: registerPassword
    });

    if (!payloadParsed.success) {
      pushToast(payloadParsed.error.issues[0]?.message ?? "Invalid sign up details", "error");
      return;
    }

    const normalizedPhone = registerResolvedPhone || composeArkeselPhoneInput(registerCountryCode, registerPhone);
    if (!normalizedPhone) {
      const directPhoneCandidate = normalizeAuthPhoneInput(registerPhone);
      if (directPhoneCandidate && !isArkeselSupportedPhoneInput(directPhoneCandidate)) {
        pushToast(unsupportedOtpPhoneMessage("register"), "info");
        return;
      }

      pushToast("Choose a supported country code and enter a valid mobile number.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await verifyAuthOtp({
        intent: "register",
        phone: normalizedPhone,
        code: codeParsed.data.code,
        display_name: payloadParsed.data.display_name,
        password: payloadParsed.data.password,
        ...(payloadParsed.data.email ? { email: payloadParsed.data.email } : {})
      });

      const authResult = await signInWithIdentifier(normalizedPhone, payloadParsed.data.password);
      if (authResult.session) {
        setSession(authResult.session);
      }
      pushToast("Account created", "success");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const authError = error as Error & { code?: string };
      if (authError.code === "unsupported_phone_country") {
        pushToast(authError.message || unsupportedOtpPhoneMessage("register"), "info");
      } else {
        pushToast(error instanceof Error ? error.message : "Could not verify OTP", "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function requestResetOtp(identifierOverride?: string, switchMode = false) {
    const identifierValue = (identifierOverride ?? resetIdentifier).trim();
    const parsed = authResetRequestSchema.safeParse({
      identifier: identifierValue
    });

    if (!parsed.success) {
      pushToast(parsed.error.issues[0]?.message ?? "Invalid reset details", "error");
      return;
    }

    if (switchMode) {
      setModeDirection("to-login");
      setMode("reset");
    }

    if (!looksLikePotentialEmail(parsed.data.identifier)) {
      const normalizedPhoneCandidate = normalizeAuthPhoneInput(parsed.data.identifier);
      if (normalizedPhoneCandidate && !isArkeselSupportedPhoneInput(normalizedPhoneCandidate)) {
        pushToast(unsupportedOtpPhoneMessage("reset"), "info");
        return;
      }
    }

    setResetIdentifier(parsed.data.identifier);
    setSubmitting(true);
    try {
      const payload = await sendAuthOtp({
        intent: "reset",
        identifier: parsed.data.identifier
      });

      setResetResolvedPhone(payload.phone);
      setResetDestination(payload.destination);
      setResetStep("verify");
      setResetOtpCode("");
      pushToast(`Reset OTP sent to ${payload.destination}`, "success");
    } catch (error) {
      const authError = error as Error & { code?: string };
      if (authError.code === "unsupported_phone_country") {
        pushToast(authError.message || unsupportedOtpPhoneMessage("reset"), "info");
      } else {
        pushToast(error instanceof Error ? error.message : "Could not send reset OTP", "error");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function completePasswordReset() {
    const parsed = authResetVerifySchema.safeParse({
      code: resetOtpCode,
      new_password: resetNewPassword
    });

    if (!parsed.success) {
      pushToast(parsed.error.issues[0]?.message ?? "Invalid reset details", "error");
      return;
    }

    const normalizedPhone = normalizeAuthPhoneInput(resetResolvedPhone);
    if (!normalizedPhone) {
      pushToast("Request a new reset OTP and try again.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await verifyAuthOtp({
        intent: "reset",
        phone: normalizedPhone,
        code: parsed.data.code,
        new_password: parsed.data.new_password
      });

      const authResult = await signInWithIdentifier(normalizedPhone, parsed.data.new_password);
      if (authResult.session) {
        setSession(authResult.session);
      }
      pushToast("Password reset successfully", "success");
      navigate(redirectTo, { replace: true });
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not reset password", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleAuth() {
    setSubmitting(true);

    try {
      await signInWithGoogle(redirectTo);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not continue with Google.", "error");
      setSubmitting(false);
    }
  }

  const inputClass =
    "auth-input mt-1 w-full rounded-xl border border-sand-300 bg-white px-3 py-2.5 text-sm text-ink outline-none transition focus:border-cobalt-500 focus:ring-2 focus:ring-cobalt-100";

  if (user) {
    return (
      <div className="mx-auto max-w-2xl">
        <section className="surface-card-vivid auth-signed-in relative overflow-hidden p-6 md:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cobalt-100/70 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-24 h-44 w-44 rounded-full bg-lagoon-100/70 blur-2xl" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-600">Session active</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink">You are already signed in.</h2>
            <p className="mt-2 max-w-xl text-sm text-sand-700">
              {isEditorialLogin
                ? "Continue to the blog workspace with your current editor session."
                : "Continue to Discover to browse assets, creators, and fresh blog picks."}
            </p>
            {currentUserEmail ? <p className="mt-2 text-xs text-sand-500">Signed in as {currentUserEmail}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(redirectTo, { replace: true })}
                className="rounded-full bg-cobalt-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700"
              >
                {isEditorialLogin ? "Continue to blog desk" : "Continue to Discover"}
              </button>
              <Link
                to="/market"
                className="rounded-full border border-sand-300 bg-white px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50"
              >
                Explore marketplace
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr,0.95fr]">
      <section className="order-2 auth-hero-panel relative overflow-hidden rounded-[2rem] border border-cobalt-400/40 bg-gradient-to-br from-cobalt-700 via-cobalt-600 to-[#0a3ea8] p-6 text-white shadow-[0_24px_46px_-30px_rgba(20,63,207,0.82)] md:p-8 lg:order-1">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl auth-orb-drift" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-lagoon-300/20 blur-3xl auth-orb-drift-reverse" />
        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/72">
              {isEditorialLogin ? "Blog workspace access" : "Creative commerce for African creators"}
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-white md:text-5xl">{heroTitle}</h1>
            <p className="mt-3 max-w-xl text-sm text-white/78 md:text-base">{heroCopy}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isEditorialLogin ? (
              <>
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/88">
                  Editor accounts
                </span>
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/88">
                  Story publishing
                </span>
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/88">
                  OTP recovery
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/88">
                  Mobile OTP
                </span>
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/88">
                  Secure delivery
                </span>
                <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/88">
                  Creator profiles
                </span>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {activeHeroStats.map((stat) => (
              <ValueCard key={stat.label} label={stat.label} value={stat.value} detail={stat.detail} />
            ))}
          </div>
        </div>
      </section>

      <section className="order-1 surface-card auth-form-panel relative overflow-hidden p-6 md:p-7 lg:order-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cobalt-600 via-lagoon-500 to-sunset-500" />
        <div className="relative z-10">
          {isEditorialLogin ? (
            <div className="rounded-full border border-sand-200 bg-sand-100 px-4 py-3 text-center text-sm font-semibold text-sand-700">
              {mode === "reset" ? "Blog access recovery" : "Blog staff login"}
            </div>
          ) : (
            <div className="rounded-full border border-sand-200 bg-sand-100 p-1">
              <div className="grid grid-cols-2 gap-1">
                <ModeToggle label="Log in" active={mode === "login" || mode === "reset"} onClick={() => handleModeChange("login")} />
                <ModeToggle label="Create account" active={mode === "register"} onClick={() => handleModeChange("register")} />
              </div>
            </div>
          )}

          <div key={`${mode}-${registerStep}-${resetStep}`} className={modeAnimationClass}>
            <h2 className="mt-5 font-display text-3xl font-bold text-ink">{formHeadline}</h2>
            <p className="mt-1 text-sm text-sand-700">{formHint}</p>

            {canUseGoogleAuth ? (
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleGoogleAuth();
                  }}
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-sand-300 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:border-cobalt-200 hover:bg-cobalt-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <GoogleIcon />
                  <span>{submitting ? "Connecting..." : "Continue with Google"}</span>
                </button>
                <AuthDivider label={mode === "register" ? "or sign up with mobile OTP" : "or use email or mobile"} />
              </div>
            ) : null}

            {mode === "login" ? (
              <form className={`${canUseGoogleAuth ? "mt-4" : "mt-5"} space-y-4`} onSubmit={handleLoginSubmit}>
                <div>
                  <label htmlFor="loginIdentifier" className="block text-sm font-medium text-sand-800">
                    Email or mobile number
                  </label>
                  <input
                    id="loginIdentifier"
                    value={loginIdentifier}
                    onChange={(event) => setLoginIdentifier(event.target.value)}
                    autoComplete="username"
                    required
                    placeholder="name@example.com or +233..."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="loginPassword" className="block text-sm font-medium text-sand-800">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="loginPassword"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      minLength={6}
                      placeholder="Enter your password"
                      className={`${inputClass} pr-16 mt-0`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cobalt-700 transition hover:bg-cobalt-50"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Please wait..." : "Log in"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetIdentifier(loginIdentifier);
                    resetResetVerificationState();
                    handleModeChange("reset");
                  }}
                  className="w-full text-sm font-semibold text-cobalt-700 hover:text-cobalt-800"
                >
                  Forgot password? Reset with OTP
                </button>
              </form>
            ) : null}

            {mode === "register" && registerStep === "details" ? (
              <form
                className={`${canUseGoogleAuth ? "mt-4" : "mt-5"} space-y-4`}
                onSubmit={(event) => {
                  event.preventDefault();
                  void requestRegisterOtp();
                }}
              >
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-sand-800">
                    Creative name
                  </label>
                  <input
                    id="displayName"
                    value={registerDisplayName}
                    onChange={(event) => setRegisterDisplayName(event.target.value)}
                    required
                    placeholder="How should buyers know you?"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="registerPhone" className="block text-sm font-medium text-sand-800">
                    Mobile number
                  </label>
                  <div className="mt-1 flex items-stretch gap-2">
                    <div className="w-28 shrink-0">
                      <label htmlFor="registerCountryCode" className="sr-only">
                        Country code
                      </label>
                      <select
                        id="registerCountryCode"
                        value={registerCountryCode}
                        onChange={(event) => setRegisterCountryCode(event.target.value)}
                        className={`${inputClass} mt-0 w-full appearance-none px-2.5 pr-7 text-xs sm:text-sm`}
                      >
                        {ARKESEL_SUPPORTED_COUNTRIES.map((country) => (
                          <option key={country.code} value={country.dialCode}>
                            {country.country} ({country.dialCode})
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      id="registerPhone"
                      value={registerPhone}
                      onChange={(event) => setRegisterPhone(event.target.value.replace(/[^\d\s()-]/g, ""))}
                      autoComplete="tel-national"
                      inputMode="tel"
                      required
                      placeholder={selectedRegisterCountry?.exampleLocalNumber ?? "0241234567"}
                      className={`${inputClass} mt-0 min-w-0 flex-1`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-cobalt-700">
                    OTP sign-up supports {supportedCountryCopy} mobile numbers. If yours is outside those countries, use Google or email instead.
                  </p>
                </div>

                <div>
                  <label htmlFor="registerEmail" className="block text-sm font-medium text-sand-800">
                    Email <span className="text-sand-500">(optional)</span>
                  </label>
                  <input
                    id="registerEmail"
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-cobalt-700">Useful for checkout receipts and future account recovery.</p>
                </div>

                <div>
                  <label htmlFor="registerPassword" className="block text-sm font-medium text-sand-800">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="registerPassword"
                      value={registerPassword}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      className={`${inputClass} pr-16 mt-0`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cobalt-700 transition hover:bg-cobalt-50"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <PasswordStrengthIndicator level={registerPasswordStrength.level} />
                  <div>
                    <label htmlFor="registerConfirmPassword" className="block text-sm font-medium text-sand-800">
                      Confirm password
                    </label>
                    <input
                      id="registerConfirmPassword"
                      value={registerConfirmPassword}
                      onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="Re-enter your password"
                      className={`${inputClass} ${registerConfirmMismatch ? "border-sunset-300 focus:border-sunset-500 focus:ring-sunset-100" : ""}`}
                    />
                    <p className={`mt-1 text-[11px] ${registerConfirmMismatch ? "text-sunset-700" : "text-cobalt-700"}`}>
                      {registerConfirmPassword.length === 0
                        ? "Re-enter your password to confirm."
                        : registerConfirmMismatch
                          ? "Passwords do not match yet."
                          : "Passwords match."}
                    </p>
                  </div>
                </div>

                {existingAccountHint ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-800">We found an account with those details.</p>
                    <p className="mt-1 text-sm text-amber-700">
                      Sign in with the existing account, or send a reset OTP to {existingAccountHint.destination}.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginIdentifier(existingAccountHint.identifier);
                          handleModeChange("login");
                        }}
                        className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-800 transition hover:bg-amber-100"
                      >
                        Sign in instead
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void requestResetOtp(existingAccountHint.identifier, true);
                        }}
                        className="rounded-full border border-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-amber-800 transition hover:bg-amber-100"
                      >
                        Send reset OTP
                      </button>
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Sending OTP..." : "Send verification OTP"}
                </button>
              </form>
            ) : null}

            {mode === "register" && registerStep === "verify" ? (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void completeRegister();
                }}
              >
                <div className="auth-otp-summary rounded-2xl border border-cobalt-100 bg-cobalt-50/70 p-4">
                  <p className="auth-otp-summary-label text-xs font-semibold uppercase tracking-[0.14em] text-cobalt-700">Verification destination</p>
                  <p className="auth-otp-summary-value mt-1 text-sm font-semibold text-ink">{registerDestination || maskPhoneNumber(registerResolvedPhone)}</p>
                  <p className="auth-otp-summary-copy mt-1 text-xs text-sand-600">Use the OTP we sent to complete your account setup.</p>
                </div>

                <div>
                  <label htmlFor="registerOtpCode" className="block text-sm font-medium text-sand-800">
                    OTP code
                  </label>
                  <input
                    id="registerOtpCode"
                    value={registerOtpCode}
                    onChange={(event) => setRegisterOtpCode(event.target.value.replace(/\D+/g, ""))}
                    inputMode="numeric"
                    maxLength={8}
                    required
                    placeholder="Enter code"
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Verifying..." : "Verify and create account"}
                </button>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void requestRegisterOtp();
                    }}
                    disabled={submitting}
                    className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetRegisterVerificationState();
                    }}
                    disabled={submitting}
                    className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Edit details
                  </button>
                </div>
              </form>
            ) : null}

            {mode === "reset" && resetStep === "details" ? (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void requestResetOtp();
                }}
              >
                <div>
                  <label htmlFor="resetIdentifier" className="block text-sm font-medium text-sand-800">
                    Email or mobile number
                  </label>
                  <input
                    id="resetIdentifier"
                    value={resetIdentifier}
                    onChange={(event) => setResetIdentifier(event.target.value)}
                    autoComplete="username"
                    required
                    placeholder="name@example.com or +233..."
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-sand-500">
                    We will send the reset OTP to the mobile number linked to that account. OTP reset currently supports {supportedCountryCopy} mobile numbers.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Sending OTP..." : "Send reset OTP"}
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange("login")}
                  className="w-full text-sm font-semibold text-cobalt-700 hover:text-cobalt-800"
                >
                  Back to sign in
                </button>
              </form>
            ) : null}

            {mode === "reset" && resetStep === "verify" ? (
              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void completePasswordReset();
                }}
              >
                <div className="auth-otp-summary rounded-2xl border border-cobalt-100 bg-cobalt-50/70 p-4">
                  <p className="auth-otp-summary-label text-xs font-semibold uppercase tracking-[0.14em] text-cobalt-700">Reset destination</p>
                  <p className="auth-otp-summary-value mt-1 text-sm font-semibold text-ink">{resetDestination || maskPhoneNumber(resetResolvedPhone)}</p>
                  <p className="auth-otp-summary-copy mt-1 text-xs text-sand-600">Enter the OTP and choose your new password.</p>
                </div>

                <div>
                  <label htmlFor="resetOtpCode" className="block text-sm font-medium text-sand-800">
                    OTP code
                  </label>
                  <input
                    id="resetOtpCode"
                    value={resetOtpCode}
                    onChange={(event) => setResetOtpCode(event.target.value.replace(/\D+/g, ""))}
                    inputMode="numeric"
                    maxLength={8}
                    required
                    placeholder="Enter code"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="resetNewPassword" className="block text-sm font-medium text-sand-800">
                    New password
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="resetNewPassword"
                      value={resetNewPassword}
                      onChange={(event) => setResetNewPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="Choose a new password"
                      className={`${inputClass} pr-16 mt-0`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cobalt-700 transition hover:bg-cobalt-50"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <PasswordStrengthIndicator level={resetPasswordStrength.level} />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Resetting..." : "Verify OTP and reset password"}
                </button>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void requestResetOtp(resetIdentifier);
                    }}
                    disabled={submitting}
                    className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Resend OTP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetResetVerificationState();
                    }}
                    disabled={submitting}
                    className="rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Change account
                  </button>
                </div>
              </form>
            ) : null}

            {isEditorialLogin ? (
              <p className="mt-4 text-center text-sm text-sand-700">
                Need an editor account? <span className="font-semibold text-cobalt-700">Ask a platform admin to provision blog access for you.</span>
              </p>
            ) : (
              <p className="mt-4 text-center text-sm text-sand-700">
                {mode === "register" ? "Already have an account?" : "New to Crib?"}{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange(mode === "register" ? "login" : "register")}
                  className="font-semibold text-cobalt-700 hover:text-cobalt-800"
                >
                  {mode === "register" ? "Log in" : "Create account"}
                </button>
              </p>
            )}

            <p className="mt-2 text-center text-sm text-sand-600">
              Want to browse first?{" "}
              <Link to="/market" className="font-semibold text-cobalt-700 hover:text-cobalt-800">
                Go to marketplace
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-sand-500">
      <span className="h-px flex-1 bg-sand-200" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-sand-200" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 4 1.5l2.7-2.6C17 3.2 14.8 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.8-.1-1.2H12Z" />
      <path fill="#34A853" d="M3.4 7.3 6.6 9.7C7.5 7.6 9.6 6 12 6c1.9 0 3.2.8 4 1.5l2.7-2.6C17 3.2 14.8 2.2 12 2.2c-3.8 0-7.1 2.2-8.6 5.1Z" />
      <path fill="#FBBC05" d="M12 21.8c2.7 0 5-.9 6.6-2.5l-3-2.5c-.8.6-1.9 1.2-3.6 1.2-3.9 0-5.1-2.6-5.4-3.9l-3.2 2.5c1.5 3 4.7 5.2 8.6 5.2Z" />
      <path fill="#4285F4" d="M21.1 13.3c.1-.4.1-.8.1-1.3s0-.9-.1-1.3H12v3.9h5.5c-.2 1.2-1 2.3-2 3l3 2.5c1.8-1.7 2.6-4.1 2.6-6.8Z" />
    </svg>
  );
}

function ModeToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-white text-ink shadow-sm" : "text-sand-600 hover:bg-white/80 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function ValueCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-[1.25rem] border border-white/14 bg-white/10 p-4 backdrop-blur-sm landing-hover-lift">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/62">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/72">{detail}</p>
    </article>
  );
}

function looksLikePotentialEmail(input: string) {
  return input.includes("@");
}

function PasswordStrengthIndicator({ level }: { level: number }) {
  const activeClass =
    level <= 1 ? "bg-sunset-500" : level === 2 ? "bg-ember-500" : level === 3 ? "bg-lagoon-500" : "bg-forest-500";

  return (
    <div className="mt-2 grid grid-cols-4 gap-1" aria-label={`Password strength level ${level} of 4`}>
      {[1, 2, 3, 4].map((segment) => (
        <span key={segment} className={`h-1.5 rounded-full transition ${segment <= level ? activeClass : "bg-sand-200"}`} />
      ))}
    </div>
  );
}

function evaluatePasswordStrength(password: string) {
  if (!password) {
    return {
      level: 0,
      label: "Not set",
      hint: "Use 12+ characters with uppercase, lowercase, a number, and a symbol."
    };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const level = Math.max(1, Math.min(4, Math.ceil((score / 5) * 4)));

  if (level === 1) {
    return {
      level,
      label: "Weak",
      hint: "Increase length and include mixed case, numbers, and symbols."
    };
  }

  if (level === 2) {
    return {
      level,
      label: "Fair",
      hint: "Add more complexity for stronger account protection."
    };
  }

  if (level === 3) {
    return {
      level,
      label: "Good",
      hint: "Strong base. Add a symbol or extra length to max out."
    };
  }

  return {
    level,
    label: "Strong",
    hint: "Great password strength."
  };
}
