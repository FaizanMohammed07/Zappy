export function SkeletonLine({ className = '' }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`card space-y-3 ${className}`}>
      <SkeletonLine className="h-4 w-2/3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <SkeletonLine key={i} className={`h-3 ${i === lines - 2 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonOrderCard() {
  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <SkeletonLine className="h-4 w-40" />
          <SkeletonLine className="h-3 w-56" />
        </div>
        <SkeletonLine className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <SkeletonLine className="h-3 w-24" />
        <SkeletonLine className="h-4 w-16" />
      </div>
    </div>
  );
}

export function SkeletonServiceCard() {
  return (
    <div className="card space-y-3">
      <SkeletonLine className="h-11 w-11 rounded-xl" />
      <SkeletonLine className="h-4 w-3/4" />
      <SkeletonLine className="h-3 w-full" />
      <SkeletonLine className="h-3 w-2/3" />
      <div className="flex justify-between pt-1">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine className="h-3 w-14" />
      </div>
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="card text-center space-y-2">
      <SkeletonLine className="h-4 w-8 mx-auto rounded-full" />
      <SkeletonLine className="h-7 w-16 mx-auto" />
      <SkeletonLine className="h-2.5 w-12 mx-auto rounded-full" />
    </div>
  );
}

export function SkeletonProfileHeader() {
  return (
    <div className="bg-white border-b border-slate-100 px-4 py-6">
      <div className="flex items-center gap-4">
        <div className="skeleton w-16 h-16 rounded-2xl shrink-0" />
        <div className="space-y-2 flex-1">
          <SkeletonLine className="h-5 w-32" />
          <SkeletonLine className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonNotification() {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
      <div className="space-y-2 flex-1">
        <SkeletonLine className="h-4 w-48" />
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-2.5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4, Item = SkeletonCard }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}
