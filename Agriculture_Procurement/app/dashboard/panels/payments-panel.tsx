"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDollarSign, Download, Loader2, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, downloadApiFile, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { DappUser, PaginatedResponse, PaymentRecord, PaymentStatus, ProcurementTransaction } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

type ReconcileAction = "SETTLE" | "FAIL";
type ReconcileDraft = { payment: PaymentRecord; action: ReconcileAction; reference: string; note: string };

function idempotencyKey(action: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${action.toLowerCase()}-${suffix}`.slice(0, 64);
}

const statusClasses: Record<PaymentStatus, string> = {
  INITIATED: "border-sky-200 bg-sky-50 text-sky-800",
  PROCESSING: "border-amber-200 bg-amber-50 text-amber-800",
  SETTLED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  FAILED: "border-rose-200 bg-rose-50 text-rose-800",
};

export function PaymentsPanel({ user }: { user: DappUser }) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [transactions, setTransactions] = useState<ProcurementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconcile, setReconcile] = useState<ReconcileDraft | null>(null);

  const canOperate = user.role !== "FARMER";
  const isAdmin = user.role === "ADMIN";

  const loadPayments = useCallback(async () => {
    try {
      if (canOperate) {
        const [paymentPage, transactionPage] = await Promise.all([
          apiRequest<PaginatedResponse<PaymentRecord>>("/payments/"),
          apiRequest<PaginatedResponse<ProcurementTransaction>>("/procurement-transactions/"),
        ]);
        setPayments(paymentPage.results);
        setTransactions(transactionPage.results);
      } else {
        const page = await apiRequest<PaginatedResponse<PaymentRecord>>("/payments/");
        setPayments(page.results);
      }
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [canOperate]);

  useEffect(() => {
    // Client-only API hydration; state updates occur after the promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPayments();
  }, [loadPayments]);

  const totals = useMemo(() => {
    const settled = payments.filter((item) => item.status === "SETTLED").reduce((sum, item) => sum + Number(item.amount), 0);
    const outstanding = payments.filter((item) => item.status !== "SETTLED").reduce((sum, item) => sum + Number(item.amount), 0);
    return { settled, outstanding, failed: payments.filter((item) => item.status === "FAILED").length };
  }, [payments]);
  const uninitiated = transactions.filter((item) => item.payment_status === "UNINITIATED");

  async function initiate(transaction: ProcurementTransaction) {
    setBusy(transaction.id);
    try {
      await apiRequest<PaymentRecord>("/payments/", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey("initiate") },
        body: JSON.stringify({
          transaction: transaction.id,
          method: "DBT",
          beneficiary_reference: "Verified farmer account",
          note: "Initiated from the verified procurement ledger.",
        }),
      });
      toast.success("Payment initiated and linked to the transaction.");
      await loadPayments();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function transition(payment: PaymentRecord, action: "START_PROCESSING" | "RETRY") {
    setBusy(payment.id);
    try {
      await apiRequest<PaymentRecord>(`/payments/${payment.id}/transition/`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey(action) },
        body: JSON.stringify({ action, note: action === "RETRY" ? "Beneficiary details revalidated." : "Submitted to the payment rail." }),
      });
      toast.success(action === "RETRY" ? "Payment queued for retry." : "Payment moved to processing.");
      await loadPayments();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function submitReconciliation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reconcile) return;
    setBusy(reconcile.payment.id);
    try {
      await apiRequest<PaymentRecord>(`/payments/${reconcile.payment.id}/transition/`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey(reconcile.action) },
        body: JSON.stringify(reconcile.action === "SETTLE"
          ? { action: "SETTLE", bank_reference: reconcile.reference, note: reconcile.note }
          : { action: "FAIL", failure_reason: reconcile.note }),
      });
      toast.success(reconcile.action === "SETTLE" ? "Settlement verified; proof is now available." : "Failure recorded in the payment audit trail.");
      setReconcile(null);
      await loadPayments();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function downloadProof(payment: PaymentRecord) {
    if (!payment.receipt) return;
    setBusy(payment.id);
    try {
      await downloadApiFile(`/payments/${payment.id}/receipt/`, `${payment.receipt.receipt_number}.pdf`);
      toast.success("Settlement proof downloaded.");
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadPayments()} />;

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow={canOperate ? "Transaction-linked settlement" : "Your payment ledger"}
        title="Payments and reconciliation"
        description={canOperate
          ? "Initiate the exact payable amount from a completed procurement record, track every attempt, and reconcile bank outcomes."
          : "Track each payment from initiation to verified settlement and download proof only after reconciliation."}
        action={<Button variant="outline" onClick={() => void loadPayments()}><RefreshCw className="size-4" /> Refresh</Button>}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={CheckCircle2} label="Settled" value={formatCurrency(totals.settled)} helper={`${payments.filter((item) => item.status === "SETTLED").length} verified payment(s)`} />
        <Metric icon={CircleDollarSign} label="In payment ledger" value={formatCurrency(totals.outstanding)} helper="Initiated, processing, or failed" />
        <Metric icon={AlertTriangle} label="Needs attention" value={String(totals.failed)} helper="Failed payments eligible for retry" />
      </section>

      {canOperate && uninitiated.length > 0 ? (
        <Card className="border-sky-200 bg-sky-50/60">
          <CardHeader><CardTitle className="text-lg">Ready to initiate</CardTitle></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {uninitiated.map((transaction) => (
              <div key={transaction.id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-primary">{transaction.transaction_number}</p>
                  <p className="mt-1 font-medium">{transaction.farmer_name} · {transaction.crop_name}</p>
                  <p className="text-sm text-muted-foreground">Exact payable amount: {formatCurrency(transaction.total_amount)}</p>
                </div>
                <Button disabled={busy === transaction.id} onClick={() => void initiate(transaction)}>
                  {busy === transaction.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Initiate DBT
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {payments.length === 0 ? (
        <Card className="border-dashed bg-white"><CardContent className="py-14 text-center"><CircleDollarSign className="mx-auto mb-3 size-9 text-muted-foreground/40" /><p className="font-medium">No payments in this ledger yet</p><p className="mt-1 text-sm text-muted-foreground">A payment can begin only from a completed procurement transaction.</p></CardContent></Card>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {payments.map((payment) => (
            <Card key={payment.id} className="overflow-hidden border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
              <div className={`h-1.5 ${payment.status === "SETTLED" ? "bg-emerald-600" : payment.status === "FAILED" ? "bg-rose-500" : "bg-sky-600"}`} />
              <CardHeader className="border-b pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="font-mono text-sm font-semibold text-primary">{payment.payment_number}</p><CardTitle className="mt-2 text-xl">{formatCurrency(payment.amount)}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{payment.transaction_number} · {payment.crop_name}</p></div>
                  <Badge variant="outline" className={statusClasses[payment.status]}>{payment.status_label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {user.role !== "FARMER" ? <Fact label="Farmer" value={`${payment.farmer_name} · ${payment.farmer_code}`} /> : null}
                <div className="grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
                  <Fact label="Centre" value={`${payment.center_code} · ${payment.center_name}`} />
                  <Fact label="Method" value={payment.method_label} />
                  <Fact label="Beneficiary" value={payment.beneficiary_reference} />
                  <Fact label="Attempts" value={String(payment.attempt_count)} />
                  <Fact label="Initiated" value={formatDateTime(payment.initiated_at)} />
                  <Fact label="Bank reference" value={payment.bank_reference || "Awaiting reconciliation"} />
                </div>
                {payment.last_failure_reason ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><strong>Last failure:</strong> {payment.last_failure_reason}</div> : null}
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audit trail</p>
                  <ol className="space-y-3 border-l border-emerald-200 pl-4">
                    {payment.events.map((event) => <li key={event.id} className="text-sm"><p className="font-medium">{event.action_label} · {event.to_status.replaceAll("_", " ").toLowerCase()}</p><p className="text-xs text-muted-foreground">{event.actor_name} · {formatDateTime(event.created_at)}</p>{event.note ? <p className="mt-1 text-muted-foreground">{event.note}</p> : null}</li>)}
                  </ol>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canOperate && payment.status === "INITIATED" ? <Button disabled={busy === payment.id} onClick={() => void transition(payment, "START_PROCESSING")}><Send className="size-4" /> Start processing</Button> : null}
                  {canOperate && payment.status === "FAILED" ? <Button disabled={busy === payment.id} onClick={() => void transition(payment, "RETRY")}><RefreshCw className="size-4" /> Retry</Button> : null}
                  {isAdmin && payment.status === "PROCESSING" ? <Button onClick={() => setReconcile({ payment, action: "SETTLE", reference: "", note: "Bank confirmation matched." })}><ShieldCheck className="size-4" /> Verify settlement</Button> : null}
                  {isAdmin && ["INITIATED", "PROCESSING"].includes(payment.status) ? <Button variant="outline" onClick={() => setReconcile({ payment, action: "FAIL", reference: "", note: "" })}><AlertTriangle className="size-4" /> Record failure</Button> : null}
                  {payment.status === "SETTLED" && payment.receipt ? <Button variant="outline" disabled={busy === payment.id} onClick={() => void downloadProof(payment)}>{busy === payment.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Settlement proof</Button> : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Dialog open={reconcile !== null} onOpenChange={(open) => !open && setReconcile(null)}>
        <DialogContent>
          {reconcile ? <form onSubmit={submitReconciliation}>
            <DialogHeader><DialogTitle>{reconcile.action === "SETTLE" ? "Verify bank settlement" : "Record payment failure"}</DialogTitle><DialogDescription>{reconcile.payment.payment_number} · {formatCurrency(reconcile.payment.amount)}. This creates an immutable payment event.</DialogDescription></DialogHeader>
            <div className="my-6 space-y-5">
              {reconcile.action === "SETTLE" ? <div className="space-y-2"><Label htmlFor="bank-reference">Bank reference / UTR</Label><Input id="bank-reference" required maxLength={80} value={reconcile.reference} onChange={(event) => setReconcile({ ...reconcile, reference: event.target.value })} placeholder="Unique settlement reference" /></div> : null}
              <div className="space-y-2"><Label htmlFor="reconcile-note">{reconcile.action === "SETTLE" ? "Reconciliation note" : "Failure reason"}</Label><Textarea id="reconcile-note" required={reconcile.action === "FAIL"} maxLength={500} value={reconcile.note} onChange={(event) => setReconcile({ ...reconcile, note: event.target.value })} /></div>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setReconcile(null)}>Cancel</Button><Button type="submit" disabled={busy === reconcile.payment.id}>{busy === reconcile.payment.id ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}{reconcile.action === "SETTLE" ? "Confirm settled" : "Record failure"}</Button></DialogFooter>
          </form> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ icon: Icon, label, value, helper }: { icon: typeof CheckCircle2; label: string; value: string; helper: string }) {
  return <Card className="border-slate-200 bg-white py-5"><CardContent className="flex items-start justify-between gap-4 px-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div></CardContent></Card>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-medium text-foreground">{value}</p></div>;
}
