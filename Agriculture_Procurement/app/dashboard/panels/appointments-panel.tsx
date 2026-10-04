"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Clock3, MapPinned, Scale, TicketCheck, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatDate, formatKilograms } from "@/lib/format";
import type { DappUser, PaginatedResponse, ProcurementAppointment } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

export function AppointmentsPanel({ user }: { user: DappUser }) {
  const [appointments, setAppointments] = useState<ProcurementAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(async () => {
    try {
      const page = await apiRequest<PaginatedResponse<ProcurementAppointment>>("/appointments/");
      setAppointments(page.results);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Client-only API hydration; state updates occur after the API promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAppointments();
  }, [loadAppointments]);

  const summary = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);
    const active = appointments.filter((appointment) => ["SCHEDULED", "CHECKED_IN"].includes(appointment.status));
    const upcoming = active.filter((appointment) => appointment.scheduled_date >= today);
    return {
      active: active.length,
      upcoming: upcoming.length,
      quantity: upcoming.reduce(
        (total, appointment) => total + Number(appointment.scheduled_quantity_kg),
        0,
      ),
    };
  }, [appointments]);

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadAppointments()} />;

  const isFarmer = user.role === "FARMER";

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow={isFarmer ? "Digital arrival pass" : "Centre schedule"}
        title={isFarmer ? "Tokens & arrival slots" : "Scheduled arrivals"}
        description={
          isFarmer
            ? "Bring the active token to the named procurement centre during its arrival window."
            : "Use the daily queue to prepare for farmers with approved capacity reservations."
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={TicketCheck} label="Active tokens" value={String(summary.active)} helper="Currently scheduled" />
        <MetricCard icon={CalendarCheck2} label="Upcoming arrivals" value={String(summary.upcoming)} helper="Today and later" />
        <MetricCard icon={Scale} label="Upcoming quantity" value={formatKilograms(summary.quantity)} helper="Reserved centre intake" />
      </section>

      <Card className="border-amber-200 bg-amber-50 text-amber-950">
        <CardContent className="flex items-start gap-3 py-4 text-sm leading-6">
          <TicketCheck className="mt-0.5 size-5 shrink-0" />
          A token confirms an approved arrival slot. Completed cards show physical processing status, while the downloadable procurement receipt remains separate from proof of payment.
        </CardContent>
      </Card>

      {appointments.length === 0 ? (
        <Card className="border-dashed bg-white">
          <CardContent className="py-14 text-center">
            <CalendarCheck2 className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="font-medium">No arrival slots yet</p>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              {isFarmer ? "An active token appears after an officer approves your procurement request." : "Approved and rescheduled requests for your centre appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {appointments.map((appointment) => (
            <TokenCard key={appointment.id} appointment={appointment} showFarmer={!isFarmer} />
          ))}
        </section>
      )}
    </div>
  );
}

function TokenCard({ appointment, showFarmer }: { appointment: ProcurementAppointment; showFarmer: boolean }) {
  const active = ["SCHEDULED", "CHECKED_IN"].includes(appointment.status);
  return (
    <Card className={`overflow-hidden border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)] ${active ? "" : "opacity-65"}`}>
      <div className={`h-1.5 ${active ? "bg-[#e7b340]" : "bg-slate-300"}`} />
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Digital token</p>
            <CardTitle className="mt-2 font-mono text-xl tracking-wide">{appointment.token_code}</CardTitle>
            <CardDescription className="mt-1">{appointment.request_number}</CardDescription>
          </div>
          <Badge variant="outline" className={active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}>{appointment.status_label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="flex items-center justify-between rounded-2xl bg-[#0b3b35] p-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-emerald-100/70">Queue number</p>
            <p className="mt-1 text-3xl font-bold">#{appointment.queue_number}</p>
          </div>
          <TicketCheck className="size-9 text-[#f2c45c]" />
        </div>
        <div className="space-y-3 text-sm">
          {showFarmer ? <Info icon={UsersRound} label="Farmer" value={`${appointment.farmer_name} · ${appointment.farmer_code}`} /> : null}
          <Info icon={CalendarCheck2} label="Arrival date" value={formatDate(appointment.scheduled_date)} />
          <Info icon={Clock3} label="Arrival window" value={`${appointment.slot_start_time.slice(0, 5)}–${appointment.slot_end_time.slice(0, 5)}`} />
          <Info icon={MapPinned} label="Procurement centre" value={`${appointment.center_code} · ${appointment.center_name}`} />
          <Info icon={Scale} label={appointment.crop_name} value={formatKilograms(appointment.scheduled_quantity_kg)} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ icon: Icon, label, value, helper }: { icon: typeof TicketCheck; label: string; value: string; helper: string }) {
  return (
    <Card className="gap-3 border-slate-200 bg-white py-5 shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
      <CardContent className="flex items-start justify-between gap-4 px-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof MapPinned; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-medium leading-5">{value}</p></div>
    </div>
  );
}
