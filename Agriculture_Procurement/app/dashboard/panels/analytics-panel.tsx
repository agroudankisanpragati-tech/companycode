"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CircleDollarSign, Filter, Scale, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatKilograms } from "@/lib/format";
import type { CropCatalogueItem, PaginatedResponse, ProcurementAnalytics, ProcurementCenter } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

function todayIso() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const trendConfig = {
  payable: { label: "Payable", color: "#0b6b58" },
  settled: { label: "Settled", color: "#e2a72e" },
} satisfies ChartConfig;

const cropConfig = { quantity: { label: "Quantity (kg)", color: "#0b6b58" } } satisfies ChartConfig;

export function AnalyticsPanel() {
  const [analytics, setAnalytics] = useState<ProcurementAnalytics | null>(null);
  const [centres, setCentres] = useState<ProcurementCenter[]>([]);
  const [crops, setCrops] = useState<CropCatalogueItem[]>([]);
  const [dateFrom, setDateFrom] = useState(daysAgoIso(29));
  const [dateTo, setDateTo] = useState(todayIso);
  const [center, setCenter] = useState("ALL");
  const [crop, setCrop] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (center !== "ALL") query.set("center", center);
      if (crop !== "ALL") query.set("crop", crop);
      const [summary, centerPage, cropPage] = await Promise.all([
        apiRequest<ProcurementAnalytics>(`/analytics/summary/?${query.toString()}`),
        apiRequest<PaginatedResponse<ProcurementCenter>>("/centres/"),
        apiRequest<PaginatedResponse<CropCatalogueItem>>("/crop-catalogue/"),
      ]);
      setAnalytics(summary);
      setCentres(centerPage.results);
      setCrops(cropPage.results);
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [center, crop, dateFrom, dateTo]);

  useEffect(() => {
    // Initial analytics hydration uses the default 30-day window.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAnalytics();
  }, [loadAnalytics]);

  if (loading && !analytics) return <PanelLoading />;
  if (error && !analytics) return <PanelError message={error} onRetry={() => void loadAnalytics()} />;
  if (!analytics) return null;

  const trend = analytics.daily_trend.map((row) => ({
    ...row,
    label: row.date.slice(5),
    payable: Number(row.payable_amount),
    settled: Number(row.settled_amount),
  }));
  const cropChart = analytics.crop_breakdown.map((row) => ({ name: row.crop_code, quantity: Number(row.quantity_kg) }));

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow="Operational intelligence"
        title="Procurement analytics"
        description="Measure accepted volume, payable value, settlement performance, and exception queues from persisted operational records."
      />

      <Card className="border-slate-200 bg-white">
        <CardContent className="grid gap-4 py-5 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="From"><Input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></Field>
          <Field label="To"><Input type="date" value={dateTo} min={dateFrom} max={todayIso()} onChange={(event) => setDateTo(event.target.value)} /></Field>
          <Field label="Centre"><Select value={center} onValueChange={setCenter}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All authorised centres</SelectItem>{centres.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Crop"><Select value={crop} onValueChange={setCrop}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All crops</SelectItem>{crops.map((item) => <SelectItem key={item.id} value={item.id}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></Field>
          <div className="flex items-end"><Button className="w-full" disabled={loading} onClick={() => void loadAnalytics()}><Filter className="size-4" /> {loading ? "Applying…" : "Apply filters"}</Button></div>
        </CardContent>
      </Card>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Scale} label="Accepted quantity" value={formatKilograms(analytics.totals.accepted_quantity_kg)} helper={`${analytics.totals.transaction_count} transaction(s) · ${analytics.totals.acceptance_rate}% acceptance`} />
        <Metric icon={CircleDollarSign} label="Payable value" value={formatCurrency(analytics.totals.payable_amount)} helper={`${analytics.totals.settlement_rate}% settlement rate`} />
        <Metric icon={ShieldCheck} label="Settled" value={formatCurrency(analytics.totals.settled_amount)} helper={`${formatCurrency(analytics.totals.outstanding_amount)} outstanding`} />
        <Metric icon={AlertTriangle} label="Exception queue" value={String(analytics.totals.open_grievances + analytics.totals.failed_payments)} helper={`${analytics.totals.open_grievances} grievance(s) · ${analytics.totals.failed_payments} failed payment(s)`} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-slate-200 bg-white">
          <CardHeader><CardTitle>Payable vs settled trend</CardTitle><CardDescription>Daily INR values inside the selected transaction window.</CardDescription></CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="h-72 w-full aspect-auto">
              <LineChart data={trend} margin={{ left: 4, right: 12 }} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={55} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="payable" stroke="var(--color-payable)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="settled" stroke="var(--color-settled)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white">
          <CardHeader><CardTitle>Crop volume</CardTitle><CardDescription>Accepted kilograms by crop.</CardDescription></CardHeader>
          <CardContent>
            {cropChart.length ? <ChartContainer config={cropConfig} className="h-72 w-full aspect-auto"><BarChart data={cropChart} accessibilityLayer><CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={45} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="quantity" fill="var(--color-quantity)" radius={[5, 5, 0, 0]} /></BarChart></ChartContainer> : <div className="grid h-72 place-items-center text-sm text-muted-foreground">No crop volume in this period.</div>}
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-200 bg-white">
        <CardHeader><CardTitle>Centre performance</CardTitle><CardDescription>Persisted procurement quantity and payable value for the selected scope.</CardDescription></CardHeader>
        <CardContent>
          <Table><TableHeader><TableRow><TableHead>Centre</TableHead><TableHead className="text-right">Transactions</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Payable</TableHead></TableRow></TableHeader><TableBody>{analytics.center_breakdown.length ? analytics.center_breakdown.map((row) => <TableRow key={row.center_code}><TableCell><p className="font-medium">{row.center_code}</p><p className="text-xs text-muted-foreground">{row.center_name}</p></TableCell><TableCell className="text-right">{row.transactions}</TableCell><TableCell className="text-right">{formatKilograms(row.quantity_kg)}</TableCell><TableCell className="text-right">{formatCurrency(row.payable_amount)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No transactions match these filters.</TableCell></TableRow>}</TableBody></Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function Metric({ icon: Icon, label, value, helper }: { icon: typeof BarChart3; label: string; value: string; helper: string }) {
  return <Card className="border-slate-200 bg-white"><CardContent className="flex items-start justify-between gap-4 py-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div></CardContent></Card>;
}
