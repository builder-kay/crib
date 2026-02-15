import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="surface-card p-8 text-center">
      <h1 className="font-display text-4xl font-bold text-ink">404</h1>
      <p className="mt-2 text-sand-700">This page does not exist.</p>
      <Link to="/" className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/85">
        Back to home
      </Link>
    </div>
  );
}