"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Download, Loader2, ReceiptText, Scale, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest, downloadApiFile, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDateTime, formatKilograms } from "@/lib/format";
import type { DappUser, PaginatedResponse, PaymentStatus, ProcurementTransaction } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

const paymentClasses: Record<PaymentStatus | "UNINITIATED", string> = {
  UNINITIATED: "border-slate-200 bg-slate-50 text-slate-700",
  INITIATED: "border-sky-200 bg-sky-50 text-sky-800",
  PROCESSING: "border-amber-200 bg-amber-50 text-amber-800",
  SETTLED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  FAILED: "border-rose-200 bg-rose-50 text-rose-800",
};

export function TransactionsPanel({ user }: { user: DappUser }) {
  const [transactions, setTransactions] = useState<ProcurementTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      const page = await apiRequest<PaginatedResponse<ProcurementTransaction>>(
        "/procurement-transactions/",
      );
      setTransactions(page.results);
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
    void loadTransactions();
  }, [loadTransactions]);

  const totals = useMemo(
    () => ({
      quantity: transactions.reduce((sum, item) => sum + Number(item.accepted_quantity_kg), 0),
      amount: transactions.reduce((sum, item) => sum + Number(item.total_amount), 0),
    }),
    [transactions],
  );

  async function downloadReceipt(transaction: ProcurementTransaction) {
    setDownloading(transaction.id);
    try {
      await downloadApiFile(
        `/procurement-transactions/${transaction.id}/receipt/`,
        `${transaction.receipt.receipt_number}.pdf`,
      );
      toast.success("Receipt downloaded.");
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setDownloading(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadTransactions()} />;

  const isFarmer = user.role === "FARMER";
  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow={isFarmer ? "Your completed procurement" : "Immutable procurement ledger"}
        title={isFarmer ? "Procurement history" : "Procurement records"}
        description={isFarmer
          ? "Review accepted quantities and payable amounts, then download the receipt for each completed physical procurement."
          : "Audit accepted quantities, rates, payable amounts, and farmer receipts recorded through centre operations."}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={BadgeCheck} label="Transactions" value={String(transactions.length)} helper="Positive accepted quantity only" />
        <Metric icon={Scale} label="Quantity procured" value={formatKilograms(totals.quantity)} helper="Accepted net quantity" />
        <Metric icon={WalletCards} label="Amount payable" value={formatCurrency(totals.amount)} helper="Tracked separately in the payment ledger" />
      </section>

      <Card className="border-amber-200 bg-amber-50 text-amber-950">
        <CardContent className="flex items-start gap-3 py-4 text-sm leading-6">
          <ReceiptText className="mt-0.5 size-5 shrink-0" />
          A procurement receipt confirms accepted produce and payable value. It is not proof of payment; verified settlement proof is available separately in Payments.
        </CardContent>
      </Card>

      {transactions.length === 0 ? (
        <Card className="border-dashed bg-white">
          <CardContent className="py-14 text-center">
            <ReceiptText className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="font-medium">No completed procurement transactions</p>
            <p className="mt-1 text-sm text-muted-foreground">A record appears after a positive quantity is accepted at the physical procurement desk.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {transactions.map((transaction) => (
            <Card key={transaction.id} className="overflow-hidden border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
              <div className="h-1.5 bg-emerald-600" />
              <CardHeader className="border-b pb-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-semibold tracking-wide text-primary">{transaction.transaction_number}</p>
                    <CardTitle className="mt-2 text-xl">{transaction.crop_name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{transaction.center_code} · {transaction.center_name}</p>
                  </div>
                  <Badge variant="outline" className={paymentClasses[transaction.payment_status]}>{transaction.payment_status.replaceAll("_", " ").toLowerCase()}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-5">
                {!isFarmer ? <Fact label="Farmer" value={`${transaction.farmer_name} · ${transaction.farmer_code}`} /> : null}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Fact label="Accepted" value={formatKilograms(transaction.accepted_quantity_kg)} />
                  <Fact label="Rejected" value={formatKilograms(transaction.rejected_quantity_kg)} />
                  <Fact label="Rate" value={`${formatCurrency(transaction.rate_per_kg)}/kg`} />
                  <Fact label="Payable" value={formatCurrency(transaction.total_amount)} />
                </div>
                <div className="grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
                  <Fact label="Receipt" value={transaction.receipt.receipt_number} />
                  <Fact label="Recorded" value={formatDateTime(transaction.procured_at)} />
                  <Fact label="Token" value={transaction.token_code} />
                  <Fact label="Verification" value={transaction.receipt.verification_code} />
                </div>
                <Button variant="outline" className="w-full" disabled={downloading === transaction.id} onClick={() => void downloadReceipt(transaction)}>
                  {downloading === transaction.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {downloading === transaction.id ? "Preparing receipt…" : "Download PDF receipt"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, helper }: { icon: typeof BadgeCheck; label: string; value: string; helper: string }) {
  return <Card className="border-slate-200 bg-white py-5 shadow-[0_8px_30px_rgba(15,58,52,0.05)]"><CardContent className="flex items-start justify-between gap-4 px-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div></CardContent></Card>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium leading-5">{value}</p></div>;
}
