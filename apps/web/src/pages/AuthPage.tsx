import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/components/Toast";
import { authSchema } from "@/lib/validators/asset";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";

const heroStats = [
  { label: "Secure checkout", value: "Paystack-ready" },
  { label: "File delivery", value: "Signed URLs" },
  { label: "Creator dashboard", value: "Orders + uploads" },
  { label: "Profile discovery", value: "Identity-first" }
];

const workflowSignals = [
  "Publish digital assets",
  "Track buyer orders",
  "Update creator profile",
  "Discover fresh talent"
];

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [modeDirection, setModeDirection] = useState<"to-login" | "to-register">("to-register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const formLabel = useMemo(() => (mode === "login" ? "Log in" : "Create account"), [mode]);
  const formHeadline = useMemo(() => (mode === "login" ? "Welcome back" : "Start your creator account"), [mode]);
  const formHint = useMemo(
    () =>
      mode === "login"
        ? "Sign in to manage your uploads, orders, and profile."
        : "Create your account to publish assets and build your creator presence.",
    [mode]
  );

  const heroTitle = useMemo(
    () => (mode === "login" ? "Step back into your Crib workspace." : "Launch your creative storefront on Crib."),
    [mode]
  );
  const heroCopy = useMemo(
    () =>
      mode === "login"
        ? "Continue where you left off with one secure account for assets, orders, and profile visibility."
        : "Build an identity-first creator profile, upload products, and get discovered through curated and trending feeds.",
    [mode]
  );
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);
  const confirmMismatch = mode === "register" && confirmPassword.length > 0 && password !== confirmPassword;
  const modeAnimationClass = modeDirection === "to-register" ? "auth-mode-enter-forward" : "auth-mode-enter-back";

  function handleModeChange(nextMode: "login" | "register") {
    if (nextMode === mode) {
      return;
    }

    setModeDirection(nextMode === "register" ? "to-register" : "to-login");
    setMode(nextMode);

    if (nextMode === "login") {
      setConfirmPassword("");
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
            <p className="mt-2 max-w-xl text-sm text-sand-700">Continue to your dashboard to manage uploads and orders, or browse the marketplace.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate(redirectTo)}
                className="rounded-full bg-cobalt-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700"
              >
                Continue to dashboard
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
      <section className="order-2 surface-card-vivid auth-hero-panel relative overflow-hidden p-6 md:p-8 lg:order-1">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cobalt-100/70 blur-3xl auth-orb-drift" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-sunset-100/60 blur-3xl auth-orb-drift-reverse" />
        <div className="pointer-events-none absolute left-8 top-8 hidden h-36 w-36 rounded-full border border-cobalt-200/70 lg:block auth-ring-spin" />

        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cobalt-600">Home for African creators</p>
            <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-ink md:text-5xl">{heroTitle}</h1>
            <p className="mt-3 max-w-xl text-sm text-sand-700 md:text-base">{heroCopy}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {heroStats.map((stat) => (
              <ValueCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          <div className="rounded-2xl border border-cobalt-100 bg-white/80 p-4 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cobalt-700">Workflow snapshot</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {workflowSignals.map((signal) => (
                <span key={signal} className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-sand-700">
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="order-1 surface-card auth-form-panel relative overflow-hidden p-6 md:p-7 lg:order-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cobalt-600 via-lagoon-500 to-sunset-500" />
        <div className="relative z-10">
          <div className="rounded-full border border-sand-200 bg-sand-100 p-1">
            <div className="grid grid-cols-2 gap-1">
              <ModeToggle label="Log in" active={mode === "login"} onClick={() => handleModeChange("login")} />
              <ModeToggle label="Create account" active={mode === "register"} onClick={() => handleModeChange("register")} />
            </div>
          </div>

          <div key={mode} className={modeAnimationClass}>
            <h2 className="mt-5 font-display text-3xl font-bold text-ink">{formHeadline}</h2>
            <p className="mt-1 text-sm text-sand-700">{formHint}</p>

            <form
              className="mt-5 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();

                if (mode === "register" && password !== confirmPassword) {
                  pushToast("Confirm password does not match", "error");
                  return;
                }

                const parsed = authSchema.safeParse({
                  email,
                  password,
                  display_name: mode === "register" ? displayName : undefined
                });

                if (!parsed.success) {
                  pushToast(parsed.error.issues[0]?.message ?? "Invalid form", "error");
                  return;
                }

                setSubmitting(true);
                try {
                  if (mode === "login") {
                    const { error } = await supabase.auth.signInWithPassword({
                      email: parsed.data.email,
                      password: parsed.data.password
                    });

                    if (error) {
                      throw error;
                    }

                    pushToast("Welcome back", "success");
                    navigate(redirectTo);
                    return;
                  }

                  const { data, error } = await supabase.auth.signUp({
                    email: parsed.data.email,
                    password: parsed.data.password,
                    options: {
                      data: {
                        display_name: displayName
                      }
                    }
                  });

                  if (error) {
                    throw error;
                  }

                  if (!data.session) {
                    pushToast("Check your email to confirm your account", "info");
                  } else {
                    pushToast("Account created", "success");
                    navigate(redirectTo);
                  }
                } catch (error) {
                  pushToast(error instanceof Error ? error.message : "Authentication failed", "error");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {mode === "register" ? (
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-sand-800">
                    Display name
                  </label>
                  <input
                    id="displayName"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    placeholder="How should buyers know you?"
                    className={inputClass}
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-sand-800">
                  Email
                </label>
                <input
                  id="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-sand-800">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={6}
                    placeholder={mode === "login" ? "Enter your password" : "At least 6 characters"}
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

              {mode === "register" ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sand-700">Password strength</p>
                      <p
                        className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                          passwordStrength.level <= 1
                            ? "text-sunset-700"
                            : passwordStrength.level === 2
                              ? "text-ember-700"
                              : passwordStrength.level === 3
                                ? "text-lagoon-700"
                                : "text-forest-700"
                        }`}
                      >
                        {passwordStrength.label}
                      </p>
                    </div>
                    <div className="mt-1 grid grid-cols-4 gap-1">
                      {[1, 2, 3, 4].map((segment) => (
                        <span
                          key={segment}
                          className={`h-1.5 rounded-full transition ${
                            segment <= passwordStrength.level
                              ? passwordStrength.level <= 1
                                ? "bg-sunset-500"
                                : passwordStrength.level === 2
                                  ? "bg-ember-500"
                                  : passwordStrength.level === 3
                                    ? "bg-lagoon-500"
                                    : "bg-forest-500"
                              : "bg-sand-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-sand-500">{passwordStrength.hint}</p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-sand-800">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      placeholder="Re-enter your password"
                      className={`${inputClass} ${confirmMismatch ? "border-sunset-300 focus:border-sunset-500 focus:ring-sunset-100" : ""}`}
                    />
                    <p className={`mt-1 text-xs ${confirmMismatch ? "text-sunset-700" : "text-sand-500"}`}>
                      {confirmPassword.length === 0
                        ? "Re-enter your password to confirm."
                        : confirmMismatch
                          ? "Passwords do not match yet."
                          : "Passwords match."}
                    </p>
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-cobalt-600 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Please wait..." : formLabel}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-sand-700">
              {mode === "login" ? "New to CRIB?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => handleModeChange(mode === "login" ? "register" : "login")}
                className="font-semibold text-cobalt-700 hover:text-cobalt-800"
              >
                {mode === "login" ? "Create account" : "Log in"}
              </button>
            </p>

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

function ValueCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-sand-200 bg-white/90 p-3 landing-hover-lift">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-ink">{value}</p>
    </article>
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
