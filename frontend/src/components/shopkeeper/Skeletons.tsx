export function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 rounded-xl animate-pulse ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="h-3.5 bg-gray-100 rounded w-20" />
        <div className="h-9 w-9 bg-gray-100 rounded-xl" />
      </div>
      <div className="h-7 bg-gray-100 rounded w-16 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-24" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 7 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
      ))}
    </tr>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 animate-pulse space-y-4">
      <div className="h-5 bg-gray-100 rounded w-1/3" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-2/3" />
    </div>
  );
}
