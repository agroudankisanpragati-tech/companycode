import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function PanelHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-[#102a27] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function PanelLoading() {
  return (
    <div className="space-y-6" aria-label="Loading content">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-72 max-w-full" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-32 rounded-xl" />)}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-950">
      <AlertTitle>Could not load this section</AlertTitle>
      <AlertDescription className="mt-2">
        <p>{message}</p>
        <Button variant="outline" className="mt-4 border-amber-300 bg-white" onClick={onRetry}>
          <RefreshCw className="size-4" /> Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
