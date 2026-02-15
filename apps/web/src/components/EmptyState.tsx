import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  body: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-cobalt-200 bg-gradient-to-br from-white via-cobalt-50 to-orchid-50 p-8 text-center">
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm text-sand-600">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
