"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  MapPinned,
  Scale,
  Sprout,
  UserRoundCheck,
  WalletCards,
  Wheat,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatKilograms } from "@/lib/format";
import type { DashboardSummary, DappUser } from "@/lib/types";

import type { DashboardView } from "../dashboard-types";
import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

type Metric = {
  label: string;
  value: string;
  helper: string;
  icon: typeof Wheat;
};

export function OverviewPanel({
  user,
  onNavigate,
}: {
  user: DappUser;
  onNavigate: (view: DashboardView) => void;
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    try {
      const nextSummary = await apiRequest<DashboardSummary>("/dashboard/summary/");
      setSummary(nextSummary);
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
    void loadSummary();
  }, [loadSummary]);

  const view = useMemo(() => getOverview(summary, user), [summary, user]);

  if (loading) return <PanelLoading />;
  if (error || !summary) return <PanelError message={error ?? "Summary is unavailable."} onRetry={() => void loadSummary()} />;

  const PrimaryActionIcon = view.primaryAction.icon;

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow={`${view.roleLabel} workspace`}
        title={`Welcome, ${user.first_name || "DAPP user"}`}
        description={view.description}
        action={(
          <Button className="h-11" onClick={() => onNavigate(view.primaryAction.view)}>
            <PrimaryActionIcon className="size-4" /> {view.primaryAction.label}
          </Button>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {view.metrics.map((metric) => (
          <Card key={metric.label} className="gap-4 border-slate-200 bg-white py-5 shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
            <CardHeader className="flex grid-cols-[1fr_auto] flex-row items-start justify-between px-5">
              <div>
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="mt-2 text-2xl tracking-tight">{metric.value}</CardTitle>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <metric.icon className="size-5" />
              </div>
            </CardHeader>
            <CardContent className="px-5 text-xs text-muted-foreground">{metric.helper}</CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
          <CardHeader>
            <CardTitle className="text-lg">{view.setup.title}</CardTitle>
            <CardDescription>{view.setup.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">Foundation progress</span>
              <Badge variant="secondary">{view.setup.completed} of {view.setup.steps.length}</Badge>
            </div>
            <Progress value={(view.setup.completed / view.setup.steps.length) * 100} />
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {view.setup.steps.map((step, index) => {
                const complete = index < view.setup.completed;
                return (
                  <li key={step} className={`rounded-xl border p-4 text-sm ${complete ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "bg-muted/35 text-muted-foreground"}`}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em]">Step {index + 1}</span>
                      {complete ? <CheckCircle2 className="size-4 text-emerald-600" /> : <span className="size-4 rounded-full border" />}
                    </div>
                    {step}
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-[#0b3b35] text-white shadow-[0_12px_36px_rgba(11,59,53,0.18)]">
          <CardHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-xl bg-white/10 text-[#f2c45c]">
              <ClipboardCheck className="size-5" />
            </div>
            <CardTitle className="text-xl">The procurement rule</CardTitle>
            <CardDescription className="text-emerald-50/70">DAPP never counts an intent to sell as completed procurement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-emerald-50/80">
            <p><strong className="text-white">Request:</strong> crop, intended quantity, preferred centre, and requested date.</p>
            <p><strong className="text-white">Transaction:</strong> created later from physical inspection, weighment, and accepted quantity.</p>
            <p><strong className="text-white">Payment:</strong> linked one-to-one to that transaction and proved only after verified bank settlement.</p>
            <Badge className="mt-2 bg-[#f2c45c] text-[#17372f]">Operations and settlement · Milestone 5</Badge>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function getOverview(summary: DashboardSummary | null, user: DappUser) {
  if (!summary || summary.role !== user.role) {
    return {
      roleLabel: "DAPP",
      description: "Your workspace foundation is being loaded.",
      primaryAction: { label: "View centres", view: "centres" as DashboardView, icon: MapPinned },
      metrics: [] as Metric[],
      setup: { title: "Workspace setup", description: "Complete the available foundation steps.", completed: 1, steps: ["Account ready"] },
    };
  }

  if (summary.role === "FARMER") {
    const completed = 1 + Number(summary.profile_completed) + Number(summary.registered_crops > 0) + Number(summary.active_requests > 0);
    const nextAction = !summary.profile_completed
      ? { label: "Complete profile", view: "farmer-profile" as DashboardView, icon: UserRoundCheck }
      : summary.registered_crops === 0
        ? { label: "Add crop", view: "farmer-crops" as DashboardView, icon: Sprout }
        : { label: "Create request", view: "procurement-requests" as DashboardView, icon: ClipboardCheck };
    return {
      roleLabel: "Farmer",
      description: "Track the complete journey from selling request and physical procurement to payment settlement, notifications, and grievance resolution.",
      primaryAction: nextAction,
      metrics: [
        { label: "Completed procurements", value: String(summary.total_procurements), helper: `${summary.farmer_code} · accepted transactions`, icon: CheckCircle2 },
        { label: "Amount settled", value: formatCurrency(summary.amount_settled), helper: "Verified bank reconciliation", icon: WalletCards },
        { label: "Outstanding", value: formatCurrency(summary.amount_outstanding), helper: `From ${formatCurrency(summary.amount_payable)} total payable`, icon: Scale },
        { label: "Updates requiring attention", value: String(summary.unread_notifications + summary.open_grievances), helper: `${summary.unread_notifications} unread · ${summary.open_grievances} open grievance(s)`, icon: BellRing },
      ],
      setup: {
        title: "Request readiness",
        description: "A request becomes procurement only after physical inspection, weighment, and positive acceptance.",
        completed,
        steps: ["Account created", "Profile completed", "Crop registered", "Request submitted"],
      },
    };
  }

  if (summary.role === "PROCUREMENT_OFFICER") {
    return {
      roleLabel: "Procurement officer",
      description: summary.center_assigned
        ? "Operate your assigned centre from request review through procurement, payment initiation, and grievance handling."
        : "An administrator must assign a centre before operational records become available.",
      primaryAction: summary.center_assigned
        ? { label: "Open procurement desk", view: "procurement-desk" as DashboardView, icon: Scale }
        : { label: "View my centre", view: "centres" as DashboardView, icon: MapPinned },
      metrics: [
        { label: "Pending requests", value: String(summary.pending_requests), helper: summary.assigned_center?.code ?? "No centre assigned", icon: ClipboardCheck },
        { label: "At procurement desk", value: String(summary.processing_arrivals), helper: `${summary.appointments_today} open arrival${summary.appointments_today === 1 ? "" : "s"} today`, icon: MapPinned },
        { label: "Procured today", value: formatKilograms(summary.procured_today_kg), helper: `${summary.procurements_today} completed transaction${summary.procurements_today === 1 ? "" : "s"}`, icon: Scale },
        { label: "Payment queue", value: String(summary.unsettled_payments), helper: `${summary.open_grievances} open grievance(s)`, icon: WalletCards },
      ],
      setup: {
        title: "Officer workflow",
        description: "Each physical stage is recorded once and the transaction is created only from accepted quantity.",
        completed: summary.center_assigned ? 4 : 1,
        steps: ["Officer account", "Centre assigned", "Arrival check-in", "Physical decision"],
      },
    };
  }

  const adminComplete = 1 + Number(summary.active_centers > 0) + Number(summary.catalogue_crops > 0) + Number(summary.assigned_officers > 0);
  return {
    roleLabel: "Administrator",
    description: "Oversee procurement, settlement reconciliation, exception handling, and performance analytics across every centre.",
    primaryAction: { label: "Open analytics", view: "analytics" as DashboardView, icon: ClipboardCheck },
    metrics: [
      { label: "Transactions", value: String(summary.total_procurements), helper: "Immutable accepted records", icon: CheckCircle2 },
      { label: "Settled", value: formatCurrency(summary.amount_settled_total), helper: `Of ${formatCurrency(summary.amount_recorded_total)} payable`, icon: WalletCards },
      { label: "Outstanding", value: formatCurrency(summary.amount_outstanding_total), helper: `${summary.failed_payments} failed payment(s)`, icon: Scale },
      { label: "Exceptions", value: String(summary.open_grievances + summary.failed_payments), helper: `${summary.unread_notifications} unread update(s)`, icon: BellRing },
    ],
    setup: {
      title: "Procurement foundation",
      description: `${summary.registered_farmers} farmer accounts and ${summary.assigned_officers} active officer assignments can participate in the controlled physical workflow.`,
      completed: adminComplete,
      steps: ["Administrator account", "Centre configured", "Crop catalogue", "Officer assigned"],
    },
  };
}
