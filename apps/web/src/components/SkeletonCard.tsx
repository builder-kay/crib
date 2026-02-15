export function SkeletonCard() {
  return (
    <div className="h-[420px] animate-pulse overflow-hidden rounded-2xl border border-sand-200 bg-white">
      <div className="aspect-[4/3] bg-sand-200" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-4/5 rounded bg-sand-200" />
        <div className="h-3 w-1/2 rounded bg-sand-200" />
        <div className="h-3 w-full rounded bg-sand-100" />
      </div>
    </div>
  );
}
