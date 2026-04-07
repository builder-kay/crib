import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { getProfile, submitCreatorHireRequest } from "@/lib/api";
import { DEFAULT_HIRE_TERMS } from "@/lib/hire";
import { useAuthStore } from "@/store/authStore";

type HireCreatorModalProps = {
  open: boolean;
  creatorId: string;
  creatorName: string;
  onClose: () => void;
};

export function HireCreatorModal({ open, creatorId, creatorName, onClose }: HireCreatorModalProps) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const { pushToast } = useToast();
  const signInRedirect = `/auth?redirect=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`;

  const creatorProfileQuery = useQuery({
    queryKey: ["hire-creator-profile", creatorId],
    queryFn: () => getProfile(creatorId),
    enabled: open && Boolean(creatorId)
  });

  const hireMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Sign in to hire this creator.");
      }

      if (user.id === creatorId) {
        throw new Error("You cannot hire yourself.");
      }

      await submitCreatorHireRequest(creatorId);
    },
    onSuccess: () => {
      pushToast(`Hire request sent to ${creatorName}.`, "success");
      onClose();
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : "Could not send the hire request.", "error");
    }
  });

  const creatorProfile = creatorProfileQuery.data;
  const creatorTerms = creatorProfile?.hire_terms?.trim() || DEFAULT_HIRE_TERMS;
  const creatorCanBeHired = creatorProfile?.hire_enabled ?? true;
  const isOwnProfile = Boolean(user?.id && user.id === creatorId);

  return (
    <Modal
      open={open}
      title={`Hire ${creatorName}`}
      onClose={() => {
        if (!hireMutation.isPending) {
          onClose();
        }
      }}
      maxWidthClassName="max-w-2xl"
    >
      <div className="min-h-[18rem]">
        {creatorProfileQuery.isLoading ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cobalt-100 bg-cobalt-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Terms of hire</p>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-full animate-pulse rounded-full bg-cobalt-100" />
                <div className="h-3 w-full animate-pulse rounded-full bg-cobalt-100" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-cobalt-100" />
                <div className="h-3 w-4/6 animate-pulse rounded-full bg-cobalt-100" />
              </div>
            </div>

            <p className="text-sm text-sand-600">Loading hire terms...</p>
          </div>
        ) : null}

        {creatorProfileQuery.isError ? (
          <p className="text-sm text-rose-700">
            {creatorProfileQuery.error instanceof Error ? creatorProfileQuery.error.message : "Could not load hire terms."}
          </p>
        ) : null}

        {!creatorProfileQuery.isLoading && !creatorProfileQuery.isError ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cobalt-100 bg-cobalt-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cobalt-700">Terms of hire</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-sand-700">{creatorTerms}</p>
            </div>

            <p className="text-sm text-sand-600">
              Sending this request notifies {creatorName} inside their CRIB account so they can review your profile and follow up.
            </p>

            {isOwnProfile ? (
              <div className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-700">
                You cannot send a hire request to your own profile.
              </div>
            ) : null}

            {!creatorCanBeHired ? (
              <div className="rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-700">
                This creator has turned off hire requests for now.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-sand-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-sand-100"
              >
                Cancel
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={() => hireMutation.mutate()}
                  disabled={hireMutation.isPending || isOwnProfile || !creatorCanBeHired}
                  className="rounded-full bg-cobalt-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {hireMutation.isPending ? "Sending request..." : "Send hire request"}
                </button>
              ) : (
                <Link
                  to={signInRedirect}
                  className="rounded-full bg-cobalt-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cobalt-700"
                >
                  Sign in to hire
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
