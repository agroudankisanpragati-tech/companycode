'use client';

const STEPS = [
  { icon: '🔍', label: 'Analyzing image quality', labelHindi: 'छवि विश्लेषण' },
  { icon: '🧠', label: 'Running AI detection model', labelHindi: 'AI मॉडल चल रहा है' },
  { icon: '📚', label: 'Searching knowledge base', labelHindi: 'ज्ञान आधार खोज' },
  { icon: '✅', label: 'Preparing your results', labelHindi: 'परिणाम तैयार हो रहे हैं' },
];

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-2.5 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700/60" />
      <div className="h-3 w-4/5 rounded-full bg-slate-100 dark:bg-slate-700/60" />
      <div className="h-3 w-3/5 rounded-full bg-slate-100 dark:bg-slate-700/60" />
    </div>
  );
}

export default function LoadingOverlay({ step = 0 }: { step?: number }) {
  const current = Math.min(step, STEPS.length - 1);
  const pct = Math.round(((current + 1) / STEPS.length) * 100);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Main AI orb card */}
      <div className="rounded-3xl border border-rose-100 dark:border-rose-900/40 bg-gradient-to-br from-rose-50 via-white to-orange-50/60 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-8 text-center shadow-sm">

        {/* Pulsing AI orb */}
        <div className="relative mx-auto mb-6 h-28 w-28">
          <div className="absolute inset-0 rounded-full bg-rose-200 dark:bg-rose-800/30 animate-ping opacity-25" />
          <div className="absolute inset-3 rounded-full bg-orange-200 dark:bg-orange-800/20 animate-ping opacity-20" style={{ animationDelay: '200ms' }} />
          <div className="absolute inset-6 rounded-full bg-rose-300 dark:bg-rose-700/20 animate-ping opacity-15" style={{ animationDelay: '400ms' }} />
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-500 shadow-2xl shadow-rose-300/50 dark:shadow-rose-900/50">
            <span className="text-4xl" style={{ animation: 'float 2s ease-in-out infinite' }}>🤖</span>
          </div>
        </div>

        <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">AI Analyzing Your Crop</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Our 3-layer AI is diagnosing the disease</p>

        {/* Step indicators */}
        <div className="mt-6 space-y-2 text-left">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-500 ${
                i < current
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                  : i === current
                  ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                  : 'bg-gray-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600'
              }`}
            >
              <span className="text-base w-5 text-center flex-shrink-0">{s.icon}</span>
              <span className="flex-1">{s.label}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:block">{s.labelHindi}</span>
              {i < current && <span className="text-emerald-500 font-bold">✓</span>}
              {i === current && (
                <span className="h-4 w-4 rounded-full border-2 border-rose-400 border-t-transparent animate-spin flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-5 h-2.5 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>Processing...</span>
          <span className="font-bold text-rose-500 dark:text-rose-400">{pct}%</span>
        </div>
      </div>

      {/* Skeleton result preview */}
      <div className="space-y-3 opacity-50">
        <SkeletonCard />
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    </div>
  );
}
