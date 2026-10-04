"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Clock3, Loader2, MessageSquareWarning, Plus, SearchCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { DappUser, Grievance, GrievanceCategory, GrievanceStatus, PaginatedResponse, PaymentRecord, ProcurementRequest, ProcurementTransaction } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

type GrievanceDraft = {
  category: GrievanceCategory;
  subject: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  request: string;
  transaction: string;
  payment: string;
};

type CloseDraft = { grievance: Grievance; action: "RESOLVE" | "REJECT"; note: string };

const blankDraft: GrievanceDraft = {
  category: "OTHER", subject: "", description: "", priority: "NORMAL", request: "", transaction: "", payment: "",
};

const statusClasses: Record<GrievanceStatus, string> = {
  OPEN: "border-amber-200 bg-amber-50 text-amber-800",
  UNDER_REVIEW: "border-sky-200 bg-sky-50 text-sky-800",
  RESOLVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
};

export function GrievancesPanel({ user }: { user: DappUser }) {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [transactions, setTransactions] = useState<ProcurementTransaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [draft, setDraft] = useState<GrievanceDraft>(blankDraft);
  const [createOpen, setCreateOpen] = useState(false);
  const [closeDraft, setCloseDraft] = useState<CloseDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFarmer = user.role === "FARMER";
  const loadGrievances = useCallback(async () => {
    try {
      if (isFarmer) {
        const [grievancePage, requestPage, transactionPage, paymentPage] = await Promise.all([
          apiRequest<PaginatedResponse<Grievance>>("/grievances/"),
          apiRequest<PaginatedResponse<ProcurementRequest>>("/procurement-requests/"),
          apiRequest<PaginatedResponse<ProcurementTransaction>>("/procurement-transactions/"),
          apiRequest<PaginatedResponse<PaymentRecord>>("/payments/"),
        ]);
        setGrievances(grievancePage.results);
        setRequests(requestPage.results);
        setTransactions(transactionPage.results);
        setPayments(paymentPage.results);
      } else {
        const page = await apiRequest<PaginatedResponse<Grievance>>("/grievances/");
        setGrievances(page.results);
      }
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [isFarmer]);

  useEffect(() => {
    // Client-only API hydration; state updates occur after the promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGrievances();
  }, [loadGrievances]);

  const metrics = useMemo(() => ({
    open: grievances.filter((item) => item.status === "OPEN").length,
    review: grievances.filter((item) => item.status === "UNDER_REVIEW").length,
    closed: grievances.filter((item) => ["RESOLVED", "REJECTED"].includes(item.status)).length,
  }), [grievances]);

  async function createGrievance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(draft).filter(([, value]) => value !== ""));
      await apiRequest<Grievance>("/grievances/", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Grievance lodged with an audit reference.");
      setDraft(blankDraft);
      setCreateOpen(false);
      await loadGrievances();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function startReview(grievance: Grievance) {
    setSaving(true);
    try {
      await apiRequest<Grievance>(`/grievances/${grievance.id}/transition/`, {
        method: "POST", body: JSON.stringify({ action: "START_REVIEW", note: "Operational review started." }),
      });
      toast.success("Grievance moved under review.");
      await loadGrievances();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function closeGrievance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!closeDraft) return;
    setSaving(true);
    try {
      await apiRequest<Grievance>(`/grievances/${closeDraft.grievance.id}/transition/`, {
        method: "POST", body: JSON.stringify({ action: closeDraft.action, note: closeDraft.note }),
      });
      toast.success(closeDraft.action === "RESOLVE" ? "Grievance resolved with a recorded response." : "Grievance rejected with a recorded reason.");
      setCloseDraft(null);
      await loadGrievances();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadGrievances()} />;

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow={isFarmer ? "Auditable support" : "Resolution queue"}
        title="Grievances"
        description={isFarmer
          ? "Lodge a concern against a request, procurement transaction, or payment and follow every review event through closure."
          : "Review grievances within your authorised scope and preserve a complete resolution trail."}
        action={isFarmer ? <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Lodge grievance</Button></DialogTrigger>
          <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
            <form onSubmit={createGrievance}>
              <DialogHeader><DialogTitle>Lodge a grievance</DialogTitle><DialogDescription>Linking a DAPP record helps the assigned team investigate without exposing bank details.</DialogDescription></DialogHeader>
              <div className="my-6 grid gap-5 sm:grid-cols-2">
                <Field label="Category" required><Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value as GrievanceCategory })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SCHEDULING">Scheduling</SelectItem><SelectItem value="QUALITY">Quality inspection</SelectItem><SelectItem value="PROCUREMENT">Procurement</SelectItem><SelectItem value="PAYMENT">Payment</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></Field>
                <Field label="Priority" required><Select value={draft.priority} onValueChange={(value) => setDraft({ ...draft, priority: value as GrievanceDraft["priority"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">High</SelectItem></SelectContent></Select></Field>
                <Field label="Subject" required className="sm:col-span-2"><Input required maxLength={160} value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /></Field>
                <Field label="Description" required className="sm:col-span-2"><Textarea required maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
                <Field label="Request (optional)"><Select value={draft.request || "NONE"} onValueChange={(value) => setDraft({ ...draft, request: value === "NONE" ? "" : value })}><SelectTrigger className="w-full"><SelectValue placeholder="No request" /></SelectTrigger><SelectContent><SelectItem value="NONE">No request</SelectItem>{requests.map((item) => <SelectItem key={item.id} value={item.id}>{item.request_number} · {item.crop_name}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Transaction (optional)"><Select value={draft.transaction || "NONE"} onValueChange={(value) => setDraft({ ...draft, transaction: value === "NONE" ? "" : value })}><SelectTrigger className="w-full"><SelectValue placeholder="No transaction" /></SelectTrigger><SelectContent><SelectItem value="NONE">No transaction</SelectItem>{transactions.map((item) => <SelectItem key={item.id} value={item.id}>{item.transaction_number}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Payment (optional)" className="sm:col-span-2"><Select value={draft.payment || "NONE"} onValueChange={(value) => setDraft({ ...draft, payment: value === "NONE" ? "" : value })}><SelectTrigger className="w-full"><SelectValue placeholder="No payment" /></SelectTrigger><SelectContent><SelectItem value="NONE">No payment</SelectItem>{payments.map((item) => <SelectItem key={item.id} value={item.id}>{item.payment_number} · {item.status_label}</SelectItem>)}</SelectContent></Select></Field>
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareWarning className="size-4" />} Submit grievance</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog> : undefined}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={CircleAlert} label="Open" value={metrics.open} helper="Awaiting a reviewer" />
        <Metric icon={SearchCheck} label="Under review" value={metrics.review} helper="Assigned and being investigated" />
        <Metric icon={CheckCircle2} label="Closed" value={metrics.closed} helper="Resolved or rejected with reason" />
      </section>

      {grievances.length === 0 ? (
        <Card className="border-dashed bg-white"><CardContent className="py-14 text-center"><MessageSquareWarning className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium">{isFarmer ? "No grievances lodged" : "The grievance queue is clear"}</p><p className="mt-1 text-sm text-muted-foreground">{isFarmer ? "Use this channel if an operational record needs review." : "Linked grievances in your authorised scope will appear here."}</p></CardContent></Card>
      ) : <section className="grid gap-5 xl:grid-cols-2">
        {grievances.map((grievance) => <Card key={grievance.id} className="border-slate-200 bg-white">
          <CardHeader className="border-b"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-sm font-semibold text-primary">{grievance.grievance_number}</p><CardTitle className="mt-2 text-xl">{grievance.subject}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{isFarmer ? grievance.category_label : `${grievance.farmer_name} · ${grievance.category_label}`}</p></div><Badge variant="outline" className={statusClasses[grievance.status]}>{grievance.status_label}</Badge></div></CardHeader>
          <CardContent className="space-y-5 pt-5">
            <p className="text-sm leading-6 text-muted-foreground">{grievance.description}</p>
            <div className="grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2"><Fact label="Priority" value={grievance.priority_label} /><Fact label="Created" value={formatDateTime(grievance.created_at)} /><Fact label="Request" value={grievance.request_number || "Not linked"} /><Fact label="Transaction / payment" value={grievance.payment_number || grievance.transaction_number || "Not linked"} /></div>
            {grievance.resolution ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><strong>Recorded resolution:</strong> {grievance.resolution}</div> : null}
            <ol className="space-y-3 border-l border-emerald-200 pl-4">{grievance.events.map((event) => <li key={event.id} className="text-sm"><p className="font-medium">{event.action_label} · {event.to_status.replaceAll("_", " ").toLowerCase()}</p><p className="text-xs text-muted-foreground">{event.actor_name} · {formatDateTime(event.created_at)}</p>{event.note ? <p className="mt-1 text-muted-foreground">{event.note}</p> : null}</li>)}</ol>
            {!isFarmer && ["OPEN", "UNDER_REVIEW"].includes(grievance.status) ? <div className="flex flex-wrap gap-2">{grievance.status === "OPEN" ? <Button disabled={saving} onClick={() => void startReview(grievance)}><Clock3 className="size-4" /> Start review</Button> : null}<Button variant="outline" onClick={() => setCloseDraft({ grievance, action: "RESOLVE", note: "" })}><CheckCircle2 className="size-4" /> Resolve</Button><Button variant="outline" onClick={() => setCloseDraft({ grievance, action: "REJECT", note: "" })}><XCircle className="size-4" /> Reject</Button></div> : null}
          </CardContent>
        </Card>)}
      </section>}

      <Dialog open={closeDraft !== null} onOpenChange={(open) => !open && setCloseDraft(null)}><DialogContent>{closeDraft ? <form onSubmit={closeGrievance}><DialogHeader><DialogTitle>{closeDraft.action === "RESOLVE" ? "Resolve grievance" : "Reject grievance"}</DialogTitle><DialogDescription>{closeDraft.grievance.grievance_number} requires a recorded explanation before closure.</DialogDescription></DialogHeader><div className="my-6 space-y-2"><Label htmlFor="resolution">Resolution</Label><Textarea id="resolution" required maxLength={2000} value={closeDraft.note} onChange={(event) => setCloseDraft({ ...closeDraft, note: event.target.value })} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCloseDraft(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Record closure</Button></DialogFooter></form> : null}</DialogContent></Dialog>
    </div>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-2 ${className ?? ""}`}><Label>{label}{required ? " *" : ""}</Label>{children}</div>;
}

function Metric({ icon: Icon, label, value, helper }: { icon: typeof CircleAlert; label: string; value: number; helper: string }) {
  return <Card className="border-slate-200 bg-white"><CardContent className="flex items-center justify-between py-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{helper}</p></div><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div></CardContent></Card>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}
