import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { getProfile, submitCreatorHireRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { DEFAULT_HIRE_TERMS } from "@/lib/hire";
import { useAuthStore } from "@/store/authStore";

type HireCreatorModalProps = {
  open: boolean;
  creatorId: string;
  creatorName: string;
  onClose: () => void;
};

type PricingGuideItem = {
  title: string;
  detail: string | null;
};

const MIN_HIRE_MESSAGE_LENGTH = 20;
const MAX_HIRE_MESSAGE_LENGTH = 2000;

export function HireCreatorModal({ open, creatorId, creatorName, onClose }: HireCreatorModalProps) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const { pushToast } = useToast();
  const [clientMessage, setClientMessage] = useState("");
  const [hasReviewedTerms, setHasReviewedTerms] = useState(false);
  const signInRedirect = `/auth?redirect=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`;

  useEffect(() => {
    if (!open) {
      return;
    }

    setClientMessage("");
    setHasReviewedTerms(false);
  }, [creatorId, open]);

  const creatorProfileQuery = useQuery({
    queryKey: ["hire-creator-profile", creatorId],
    queryFn: () => getProfile(creatorId),
    enabled: open && Boolean(creatorId)
  });

  const creatorProfile = creatorProfileQuery.data;
  const creatorTerms = creatorProfile?.hire_terms?.trim() || DEFAULT_HIRE_TERMS;
  const creatorPricingMode = creatorProfile?.hire_pricing_mode ?? (creatorProfile?.hire_pricing_guide?.trim() ? "custom_list" : "dm_to_know");
  const creatorHourlyRateKobo = creatorProfile?.hire_hourly_rate_kobo ?? null;
  const creatorPricingCurrency = creatorProfile?.hire_pricing_currency?.trim().toUpperCase() || "GHS";
  const creatorPricingGuide = creatorProfile?.hire_pricing_guide?.trim() || "";
  const creatorCanBeHired = creatorProfile?.hire_enabled ?? true;
  const isOwnProfile = Boolean(user?.id && user.id === creatorId);
  const normalizedMessage = clientMessage.trim();
  const messageLength = normalizedMessage.length;
  const isMessageTooShort = messageLength > 0 && messageLength < MIN_HIRE_MESSAGE_LENGTH;
  const isMessageTooLong = messageLength > MAX_HIRE_MESSAGE_LENGTH;

  const termParagraphs = useMemo(() => splitIntoParagraphs(creatorTerms), [creatorTerms]);
  const pricingItems = useMemo(
    () => (creatorPricingMode === "custom_list" ? parsePricingGuide(creatorPricingGuide) : []),
    [creatorPricingGuide, creatorPricingMode]
  );
  const creatorDescriptor = [creatorProfile?.creator_category?.trim(), creatorProfile?.niche?.trim()].filter(Boolean).join(" / ");
  const creatorInitials = initialsForName(creatorName);
  const hasPricingDetails =
    (creatorPricingMode === "hourly" && typeof creatorHourlyRateKobo === "number" && creatorHourlyRateKobo > 0) ||
    (creatorPricingMode === "custom_list" && creatorPricingGuide.length > 0);

  const hireMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Sign in to hire this creator.");
      }

      if (user.id === creatorId) {
        throw new Error("You cannot hire yourself.");
      }

      if (!hasReviewedTerms) {
        throw new Error("Review the creator's terms before sending your request.");
      }

      if (messageLength < MIN_HIRE_MESSAGE_LENGTH) {
        throw new Error(`Add a message with at least ${MIN_HIRE_MESSAGE_LENGTH} characters.`);
      }

      if (messageLength > MAX_HIRE_MESSAGE_LENGTH) {
        throw new Error(`Keep your message under ${MAX_HIRE_MESSAGE_LENGTH} characters.`);
      }

      await submitCreatorHireRequest(creatorId, normalizedMessage);
    },
    onSuccess: () => {
      pushToast(`Hire request sent to ${creatorName}.`, "success");
      setClientMessage("");
      setHasReviewedTerms(false);
      onClose();
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not send the hire request.", "error");
    }
  });

  const disableComposer =
    creatorProfileQuery.isLoading || creatorProfileQuery.isError || isOwnProfile || !creatorCanBeHired || !user || hireMutation.isPending;

  return (
    <Modal
      open={open}
      title={`Hire ${creatorName}`}
      hideHeader
      onClose={() => {
        if (!hireMutation.isPending) {
          onClose();
        }
      }}
      maxWidthClassName="max-w-5xl"
      panelClassName="hire-creator-modal-panel overflow-hidden p-0 sm:-translate-y-3 lg:-translate-y-5"
    >
      <div className="hire-creator-modal-shell relative isolate overflow-hidden bg-[linear-gradient(180deg,#faf8f3_0%,#f7fbff_48%,#ffffff_100%)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,rgba(39,107,255,0.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(255,170,84,0.2),transparent_38%)]" />

        <div className="sticky top-0 z-20 border-b border-sand-200/80 bg-[#faf8f3]/88 px-5 py-5 backdrop-blur-[14px] md:px-6 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[1.2rem] border border-white/80 bg-[#111723] text-lg font-semibold text-white shadow-[0_18px_30px_-22px_rgba(13,23,42,0.6)]">
                {creatorProfile?.avatar_url ? (
                  <img src={creatorProfile.avatar_url} alt={creatorName} className="h-full w-full object-cover" />
                ) : (
                  <span>{creatorInitials}</span>
                )}
              </div>

              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-cobalt-800 dark:text-cobalt-200">Hire Request</p>
                <h3 className="mt-2 font-display text-[1.7rem] font-semibold leading-none text-ink dark:text-white md:text-[2rem]">Work with {creatorName}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-sand-800 dark:text-sand-200 md:text-[0.98rem]">
                  Review the creator&apos;s engagement terms, check any public pricing notes, and send a concise brief so they can assess fit quickly.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {creatorDescriptor ? (
                    <span className="rounded-full border border-cobalt-200 bg-white/90 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-cobalt-800">
                      {creatorDescriptor}
                    </span>
                  ) : null}
                  <span
                    className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] ${
                      creatorCanBeHired
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border border-sand-300 bg-sand-100 text-sand-700"
                    }`}
                  >
                    {creatorCanBeHired ? "Accepting projects" : "Requests paused"}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center self-start rounded-full border border-sand-300 bg-white/94 px-4 py-2 text-sm font-semibold text-sand-800 transition hover:bg-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="relative grid items-start gap-4 p-4 md:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] md:gap-5 md:p-6">
          <section className="space-y-4 md:pr-1">
            {creatorProfileQuery.isLoading ? (
              <>
                <div className="rounded-[1.7rem] border border-cobalt-100/80 bg-white/90 p-5 shadow-[0_20px_40px_-34px_rgba(25,46,94,0.36)]">
                  <div className="h-3 w-28 animate-pulse rounded-full bg-cobalt-100" />
                  <div className="mt-4 space-y-3">
                    <div className="h-3 w-full animate-pulse rounded-full bg-cobalt-100" />
                    <div className="h-3 w-full animate-pulse rounded-full bg-cobalt-100" />
                    <div className="h-3 w-11/12 animate-pulse rounded-full bg-cobalt-100" />
                    <div className="h-3 w-4/5 animate-pulse rounded-full bg-cobalt-100" />
                  </div>
                </div>

                <div className="rounded-[1.7rem] border border-[#f0ddc5] bg-[#fff9f0] p-5 shadow-[0_20px_40px_-34px_rgba(101,63,20,0.22)]">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-[#f2dcc3]" />
                  <div className="mt-4 space-y-3">
                    <div className="h-3 w-full animate-pulse rounded-full bg-[#f2dcc3]" />
                    <div className="h-3 w-10/12 animate-pulse rounded-full bg-[#f2dcc3]" />
                    <div className="h-3 w-9/12 animate-pulse rounded-full bg-[#f2dcc3]" />
                  </div>
                </div>
              </>
            ) : null}

            {creatorProfileQuery.isError ? (
              <div className="rounded-[1.7rem] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-[0_18px_36px_-30px_rgba(159,18,57,0.38)]">
                {creatorProfileQuery.error instanceof Error ? creatorProfileQuery.error.message : "Could not load hire terms."}
              </div>
            ) : null}

            {!creatorProfileQuery.isLoading && !creatorProfileQuery.isError ? (
              <>
                <div className="rounded-[1.7rem] border border-cobalt-100/80 bg-white/92 p-5 shadow-[0_20px_40px_-34px_rgba(25,46,94,0.36)] md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cobalt-800 dark:text-cobalt-200">Terms &amp; conditions</p>
                      <h4 className="mt-2 text-[1.15rem] font-semibold text-ink dark:text-white">How {creatorName} works with clients</h4>
                    </div>
                    <span className="rounded-full border border-cobalt-100 bg-cobalt-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-cobalt-800">
                      Review before sending
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {termParagraphs.map((paragraph, index) => (
                      <div key={`${creatorId}-term-${index}`} className="rounded-2xl border border-sand-200/80 bg-[#fcfbf8] px-4 py-3 dark:border-sand-700/30 dark:bg-sand-900/20">
                        <p className="text-sm leading-6 text-sand-700 dark:text-sand-200">{paragraph}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {creatorPricingMode === "hourly" && typeof creatorHourlyRateKobo === "number" && creatorHourlyRateKobo > 0 ? (
                  <div className="rounded-[1.7rem] border border-cobalt-200/90 bg-[linear-gradient(180deg,#eef4ff_0%,#ffffff_100%)] p-5 shadow-[0_20px_40px_-34px_rgba(25,46,94,0.26)] md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-cobalt-700 text-white shadow-[0_16px_26px_-20px_rgba(26,56,214,0.45)]">
                        <svg className="h-[1.2rem] w-[1.2rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 1.75v20.5" />
                          <path d="M17.25 6.25H9.38a2.63 2.63 0 1 0 0 5.25h5.24a2.63 2.63 0 1 1 0 5.25H6.75" />
                        </svg>
                      </div>

                      <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-cobalt-800 dark:text-cobalt-200">Hourly pricing</p>
                        <h4 className="mt-2 text-[1.15rem] font-semibold text-ink dark:text-white">{formatCurrency(creatorHourlyRateKobo, creatorPricingCurrency)}/hr</h4>
                        <p className="mt-2 text-sm leading-6 text-sand-700 dark:text-sand-200">
                          {creatorName} bills by the hour. Share the project scope and timeline in your message so they can estimate the time accurately.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : creatorPricingMode === "custom_list" && creatorPricingGuide ? (
                  <div className="rounded-[1.7rem] border border-[#f0ddc5] bg-[linear-gradient(180deg,#fff9f1_0%,#ffffff_100%)] p-5 shadow-[0_20px_40px_-34px_rgba(101,63,20,0.22)] md:p-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-[#111723] text-white shadow-[0_16px_26px_-20px_rgba(17,23,35,0.55)]">
                        <svg className="h-[1.2rem] w-[1.2rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 1.75v20.5" />
                          <path d="M17.25 6.25H9.38a2.63 2.63 0 1 0 0 5.25h5.24a2.63 2.63 0 1 1 0 5.25H6.75" />
                        </svg>
                      </div>

                      <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7c4c17] dark:text-amber-200">Optional pricing guide</p>
                        <h4 className="mt-2 text-[1.15rem] font-semibold text-ink dark:text-white">Starter rates, retainers, or package notes</h4>
                        <p className="mt-2 text-sm leading-6 text-sand-700 dark:text-sand-200">
                          These notes come directly from the creator and are meant to help you frame your brief before they reply.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {pricingItems.map((item, index) => (
                        <div key={`${creatorId}-pricing-${index}`} className="rounded-2xl border border-[#efd8bc] bg-white/90 px-4 py-3 dark:border-amber-700/30 dark:bg-amber-900/20">
                          <p className="text-sm font-semibold text-ink dark:text-white">{item.title}</p>
                          {item.detail ? <p className="mt-1 text-sm leading-6 text-sand-700 dark:text-sand-200">{item.detail}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : creatorPricingMode === "dm_to_know" ? (
                  <div className="rounded-[1.7rem] border border-sand-200/80 bg-white/82 px-5 py-4 shadow-[0_18px_34px_-30px_rgba(16,19,36,0.2)] dark:border-sand-700/30 dark:bg-sand-900/20">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-sand-800 dark:text-sand-200">DM to know</p>
                    <p className="mt-2 text-sm leading-6 text-sand-700 dark:text-sand-200">
                      {creatorName} prefers to share pricing after reviewing the brief. Introduce the project clearly so they can send back the right quote.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[1.7rem] border border-sand-200/80 bg-white/82 px-5 py-4 shadow-[0_18px_34px_-30px_rgba(16,19,36,0.2)] dark:border-sand-700/30 dark:bg-sand-900/20">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-sand-800 dark:text-sand-200">Pricing</p>
                    <p className="mt-2 text-sm leading-6 text-sand-700 dark:text-sand-200">
                      {creatorName} has not shared a public pricing guide yet. Use your message to outline the scope, timeline, and budget range so they can quote accurately.
                    </p>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    {
                      title: "1. Review",
                      body: "Check the creator's terms so your outreach matches their process."
                    },
                    {
                      title: "2. Brief",
                      body: "Explain the project, timeline, deliverables, and budget context."
                    },
                    {
                      title: "3. Follow up",
                      body: "The creator receives your request inside Crib and can reply from there."
                    }
                  ].map((step) => (
                    <div key={step.title} className="rounded-[1.35rem] border border-sand-200/80 bg-white/82 px-4 py-4 shadow-[0_16px_28px_-26px_rgba(16,19,36,0.2)] dark:border-sand-700/30 dark:bg-sand-900/20">
                      <p className="text-sm font-semibold text-ink dark:text-white">{step.title}</p>
                      <p className="mt-2 text-sm leading-6 text-sand-700 dark:text-sand-200">{step.body}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="hire-creator-modal-brief rounded-[1.85rem] border border-cobalt-700/55 bg-[linear-gradient(180deg,#1639b8_0%,#122c98_38%,#0c1d6b_100%)] p-5 text-white shadow-[0_28px_48px_-30px_rgba(7,11,22,0.75)] md:sticky md:top-[5.4rem] md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/76">Project brief</p>
                <h4 className="mt-2 text-[1.2rem] font-semibold">Send a thoughtful intro</h4>
              </div>
              <span className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/84">
                {user ? "Ready to send" : "Sign in required"}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-white/82">
              Strong requests usually include the project goal, timeline, target deliverables, and a realistic budget range.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Scope", "Timeline", "Budget", "Deliverables"].map((pill) => (
                <span key={pill} className="rounded-full border border-white/16 bg-white/10 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white/84">
                  {pill}
                </span>
              ))}
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-white">Message to {creatorName}</span>
              <textarea
                value={clientMessage}
                onChange={(event) => setClientMessage(event.target.value)}
                rows={8}
                disabled={disableComposer}
                placeholder={`Hi ${creatorName}, I'd love to discuss a project for...`}
                className="hire-creator-modal-message mt-3 w-full resize-none rounded-[1.4rem] border border-white/14 bg-white/8 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/52 focus:border-white/30 focus:bg-white/10 focus:ring-2 focus:ring-white/12 disabled:cursor-not-allowed disabled:opacity-55"
              />
            </label>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/76">
              <p>Be specific enough that the creator can judge fit without a long back-and-forth.</p>
              <span className={isMessageTooLong ? "text-amber-300" : ""}>{messageLength}/{MAX_HIRE_MESSAGE_LENGTH}</span>
            </div>

            {isMessageTooShort ? (
              <p className="mt-2 text-sm text-amber-300">Add a little more context so the creator can understand your brief.</p>
            ) : null}

            <label className="mt-5 flex items-start gap-3 rounded-[1.35rem] border border-white/14 bg-white/8 px-4 py-3">
              <input
                type="checkbox"
                checked={hasReviewedTerms}
                onChange={(event) => setHasReviewedTerms(event.target.checked)}
                disabled={creatorProfileQuery.isLoading || creatorProfileQuery.isError || hireMutation.isPending}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-cobalt-500 focus:ring-cobalt-400"
              />
              <span className="text-sm leading-6 text-white/88">
                I&apos;ve reviewed {creatorName}&apos;s terms{hasPricingDetails ? " and pricing details" : ""} and I&apos;m ready to send this request.
              </span>
            </label>

            {isOwnProfile ? (
              <div className="mt-4 rounded-[1.35rem] border border-white/14 bg-white/8 px-4 py-3 text-sm text-white/84">
                You cannot send a hire request to your own profile.
              </div>
            ) : null}

            {!creatorCanBeHired && !creatorProfileQuery.isLoading && !creatorProfileQuery.isError ? (
              <div className="mt-4 rounded-[1.35rem] border border-white/14 bg-white/8 px-4 py-3 text-sm text-white/84">
                This creator has turned off hire requests for now.
              </div>
            ) : null}

            {!user ? (
              <div className="mt-4 rounded-[1.35rem] border border-white/14 bg-white/8 px-4 py-3 text-sm text-white/84">
                Sign in to send your message and notify the creator inside Crib.
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/16 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                Cancel
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={() => hireMutation.mutate()}
                  disabled={
                    hireMutation.isPending ||
                    creatorProfileQuery.isLoading ||
                    creatorProfileQuery.isError ||
                    isOwnProfile ||
                    !creatorCanBeHired ||
                    !hasReviewedTerms ||
                    messageLength < MIN_HIRE_MESSAGE_LENGTH ||
                    isMessageTooLong
                  }
                  className="rounded-full border border-white/16 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {hireMutation.isPending ? "Sending request..." : "Send hire request"}
                </button>
              ) : (
                <Link
                  to={signInRedirect}
                  className="rounded-full border border-white/16 bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-sand-100"
                >
                  Sign in to hire
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
}

function splitIntoParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parsePricingGuide(value: string): PricingGuideItem[] {
  return value
    .split(/\n+/)
    .map((line) => line.replace(/^[*-]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.match(/\s(?:-|:)\s/);

      if (!separator || typeof separator.index !== "number") {
        return { title: line, detail: null };
      }

      const title = line.slice(0, separator.index).trim();
      const detail = line.slice(separator.index + separator[0].length).trim();

      if (!title || !detail) {
        return { title: line, detail: null };
      }

      return { title, detail };
    });
}

function initialsForName(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CR";
}
