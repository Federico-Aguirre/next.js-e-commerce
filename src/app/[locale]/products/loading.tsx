export default function Loading() {
  return (
    <output className="space-y-10 py-8 sm:py-12" aria-busy="true">
      <div className="h-10 w-2/3 animate-pulse rounded-lg bg-muted sm:w-1/2" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="space-y-4">
            <div className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </output>
  );
}
