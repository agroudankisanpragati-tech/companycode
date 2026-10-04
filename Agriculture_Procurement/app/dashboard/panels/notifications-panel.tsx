"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { DappNotification, PaginatedResponse } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

const categoryStyle: Record<DappNotification["category"], string> = {
  APPOINTMENT: "border-sky-200 bg-sky-50 text-sky-800",
  QUALITY: "border-violet-200 bg-violet-50 text-violet-800",
  PROCUREMENT: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PAYMENT: "border-amber-200 bg-amber-50 text-amber-800",
  GRIEVANCE: "border-rose-200 bg-rose-50 text-rose-800",
  SYSTEM: "border-slate-200 bg-slate-50 text-slate-800",
};

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<DappNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const page = await apiRequest<PaginatedResponse<DappNotification>>("/notifications/");
      setNotifications(page.results);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Client-only API hydration; state updates occur after the promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadNotifications();
  }, [loadNotifications]);

  const unread = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  async function markRead(notification: DappNotification) {
    if (notification.is_read) return;
    setBusy(notification.id);
    try {
      const updated = await apiRequest<DappNotification>(`/notifications/${notification.id}/mark-read/`, { method: "POST", body: JSON.stringify({}) });
      setNotifications((items) => items.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    setBusy("all");
    try {
      const result = await apiRequest<{ marked_read: number }>("/notifications/mark-all-read/", { method: "POST", body: JSON.stringify({}) });
      toast.success(result.marked_read ? `${result.marked_read} notification(s) marked read.` : "Inbox is already up to date.");
      await loadNotifications();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadNotifications()} />;

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow="Private operational inbox"
        title="Notifications"
        description="Receive durable updates from appointment, quality, procurement, payment, and grievance workflows. Only your account can read this inbox."
        action={<div className="flex gap-2"><Button variant="outline" onClick={() => void loadNotifications()}><RefreshCw className="size-4" /> Refresh</Button><Button disabled={unread === 0 || busy === "all"} onClick={() => void markAllRead()}>{busy === "all" ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />} Mark all read</Button></div>}
      />

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="border-slate-200 bg-white"><CardContent className="flex items-center gap-4 py-5"><div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><BellRing className="size-5" /></div><div><p className="text-sm text-muted-foreground">Unread</p><p className="text-2xl font-semibold">{unread}</p></div></CardContent></Card>
        <Card className="border-slate-200 bg-white"><CardContent className="flex items-center gap-4 py-5"><div className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground"><Bell className="size-5" /></div><div><p className="text-sm text-muted-foreground">Inbox records</p><p className="text-2xl font-semibold">{notifications.length}</p></div></CardContent></Card>
      </section>

      {notifications.length === 0 ? (
        <Card className="border-dashed bg-white"><CardContent className="py-14 text-center"><Bell className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium">Your inbox is clear</p><p className="mt-1 text-sm text-muted-foreground">Workflow updates will appear here as they are recorded.</p></CardContent></Card>
      ) : (
        <section className="space-y-3">
          {notifications.map((notification) => (
            <Card key={notification.id} className={notification.is_read ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50/40 shadow-[0_6px_22px_rgba(15,58,52,0.06)]"}>
              <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${notification.is_read ? "bg-slate-300" : "bg-emerald-500"}`} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{notification.title}</p><Badge variant="outline" className={categoryStyle[notification.category]}>{notification.category_label}</Badge></div>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{notification.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(notification.created_at)}</p>
                  </div>
                </div>
                {!notification.is_read ? <Button size="sm" variant="outline" disabled={busy === notification.id} onClick={() => void markRead(notification)}>{busy === notification.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />} Mark read</Button> : null}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
