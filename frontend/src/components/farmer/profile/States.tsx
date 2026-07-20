'use client';

export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50/30 to-blue-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-700 to-lime-600 p-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-2xl bg-white/20 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-white/20 rounded-lg" />
              <div className="h-7 w-56 bg-white/20 rounded-lg" />
              <div className="h-3 w-40 bg-white/20 rounded-lg" />
            </div>
          </div>
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 animate-pulse space-y-3">
            <div className="h-5 w-40 bg-gray-200 rounded-lg" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-14 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center">
        <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">Unable to load profile</h2>
        <p className="text-sm text-gray-500 mb-6">Something went wrong. Please try again.</p>
        <button
          onClick={onRetry}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 text-sm transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
