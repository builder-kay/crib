import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { getReleaseNotifications, markReleaseNotificationAsRead } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export function NotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["release-notifications", user?.id],
    queryFn: () => getReleaseNotifications(user!.id),
    enabled: Boolean(user?.id)
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user?.id) {
        throw new Error("Sign in required.");
      }
      await markReleaseNotificationAsRead(notificationId, user.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["release-notifications", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["release-notifications-unread", user?.id] })
      ]);
    }
  });

  if (!user) {
    return (
      <EmptyState
        title="Sign in to view notifications"
        body="Follow creators to receive new release alerts."
        action={
          <Link to="/auth" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
            Sign in
          </Link>
        }
      />
    );
  }

  const notifications = notificationsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <header className="surface-card-vivid subtle-pattern p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cobalt-600">Creator Alerts</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink md:text-4xl">New Releases</h1>
        <p className="mt-2 text-sm text-sand-700 md:text-base">Updates from creators you follow.</p>
      </header>

      {notificationsQuery.isLoading ? <div className="surface-card p-5 text-sm text-sand-600">Loading notifications...</div> : null}
      {notificationsQuery.isError ? (
        <div className="surface-card p-5 text-sm text-rose-700">
          {notificationsQuery.error instanceof Error ? notificationsQuery.error.message : "Could not load notifications."}
        </div>
      ) : null}

      {!notificationsQuery.isLoading && notifications.length === 0 ? (
        <EmptyState
          title="No new release alerts"
          body="Follow creators from their profile pages to get notified when they publish new assets."
          action={
            <Link to="/creators" className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
              Browse creators
            </Link>
          }
        />
      ) : null}

      <section className="space-y-3">
        {notifications.map((notification) => {
          const unread = notification.read_at === null;
          return (
            <article key={notification.id} className="surface-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{notification.creator_name} released a new asset</p>
                  <p className="mt-1 text-sm text-sand-700">{notification.asset_title}</p>
                  <p className="mt-1 text-xs text-sand-500">{new Date(notification.created_at).toLocaleString("en-US")}</p>
                </div>

                <div className="flex items-center gap-2">
                  {unread ? (
                    <span className="rounded-full bg-cobalt-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-cobalt-700">
                      New
                    </span>
                  ) : (
                    <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-sand-600">
                      Seen
                    </span>
                  )}

                  {unread ? (
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(notification.id)}
                      disabled={markReadMutation.isPending}
                      className="rounded-full border border-sand-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-sand-700 transition hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Mark read
                    </button>
                  ) : null}

                  <Link
                    to={`/asset/${notification.asset_id}`}
                    className="rounded-full bg-cobalt-600 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-cobalt-700"
                  >
                    View asset
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
