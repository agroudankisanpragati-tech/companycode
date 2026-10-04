"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  History,
  Loader2,
  MapPinned,
  Plus,
  Scale,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatDate, formatKilograms } from "@/lib/format";
import type {
  CapacitySnapshot,
  DappUser,
  FarmerCrop,
  PaginatedResponse,
  ProcurementCenter,
  ProcurementRequest,
  ProcurementRequestStatus,
} from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

type RequestDraft = {
  farmer_crop: string;
  procurement_center: string;
  intended_quantity_kg: string;
  preferred_date: string;
  farmer_notes: string;
};

type ReviewAction = "START_REVIEW" | "APPROVE" | "RESCHEDULE" | "REJECT";

type ReviewDraft = {
  action: ReviewAction;
  scheduled_date: string;
  slot_start_time: string;
  slot_end_time: string;
  quantity_kg: string;
  review_notes: string;
};

function nextDateIso(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function blankRequest(): RequestDraft {
  return {
    farmer_crop: "",
    procurement_center: "",
    intended_quantity_kg: "",
    preferred_date: nextDateIso(),
    farmer_notes: "",
  };
}

function reviewDraftFor(request: ProcurementRequest): ReviewDraft {
  const isReschedule = request.status === "APPROVED" || request.status === "RESCHEDULED";
  return {
    action: isReschedule ? "RESCHEDULE" : request.status === "SUBMITTED" ? "START_REVIEW" : "APPROVE",
    scheduled_date: request.appointment?.scheduled_date ?? request.preferred_date,
    slot_start_time: request.appointment?.slot_start_time.slice(0, 5) ?? "09:00",
    slot_end_time: request.appointment?.slot_end_time.slice(0, 5) ?? "10:00",
    quantity_kg: request.appointment?.scheduled_quantity_kg ?? request.intended_quantity_kg,
    review_notes: "",
  };
}

export function ProcurementRequestsPanel({ user }: { user: DappUser }) {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [crops, setCrops] = useState<FarmerCrop[]>([]);
  const [centres, setCentres] = useState<ProcurementCenter[]>([]);
  const [draft, setDraft] = useState<RequestDraft>(blankRequest);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null);
  const [capacity, setCapacity] = useState<CapacitySnapshot | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ProcurementRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFarmer = user.role === "FARMER";
  const canReview = user.role === "PROCUREMENT_OFFICER" || user.role === "ADMIN";

  const loadRequests = useCallback(async () => {
    try {
      if (user.role === "FARMER") {
        const [requestPage, cropPage, centerPage] = await Promise.all([
          apiRequest<PaginatedResponse<ProcurementRequest>>("/procurement-requests/"),
          apiRequest<PaginatedResponse<FarmerCrop>>("/farmer-crops/"),
          apiRequest<PaginatedResponse<ProcurementCenter>>("/centres/"),
        ]);
        setRequests(requestPage.results);
        setCrops(cropPage.results.filter((crop) => crop.is_active));
        setCentres(centerPage.results.filter((centre) => centre.is_active));
      } else {
        const requestPage = await apiRequest<PaginatedResponse<ProcurementRequest>>(
          "/procurement-requests/",
        );
        setRequests(requestPage.results);
      }
      setError(null);
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    // Client-only API hydration; state updates occur after the API promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests();
  }, [loadRequests]);

  const metrics = useMemo(() => {
    const pending = requests.filter((request) =>
      ["SUBMITTED", "UNDER_REVIEW"].includes(request.status),
    ).length;
    const scheduled = requests.filter((request) =>
      ["APPROVED", "RESCHEDULED"].includes(request.status),
    );
    const reserved = scheduled.reduce(
      (total, request) => total + Number(request.appointment?.scheduled_quantity_kg ?? 0),
      0,
    );
    return { pending, scheduled: scheduled.length, reserved };
  }, [requests]);

  function updateDraft<K extends keyof RequestDraft>(field: K, value: RequestDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateReview<K extends keyof ReviewDraft>(field: K, value: ReviewDraft[K]) {
    setReviewDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest<ProcurementRequest>("/procurement-requests/", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      toast.success("Procurement request submitted.");
      setCreateOpen(false);
      setDraft(blankRequest());
      await loadRequests();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function loadCapacity(request: ProcurementRequest, date: string) {
    if (!date) return;
    try {
      const nextCapacity = await apiRequest<CapacitySnapshot>(
        `/centres/${request.procurement_center}/capacity/?date=${date}`,
      );
      setCapacity(nextCapacity);
    } catch {
      setCapacity(null);
    }
  }

  function openReview(request: ProcurementRequest) {
    const nextDraft = reviewDraftFor(request);
    setSelectedRequest(request);
    setReviewDraft(nextDraft);
    setCapacity(null);
    setReviewOpen(true);
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRequest || !reviewDraft) return;
    setSaving(true);
    try {
      const scheduleAction = reviewDraft.action === "APPROVE" || reviewDraft.action === "RESCHEDULE";
      await apiRequest<ProcurementRequest>(`/procurement-requests/${selectedRequest.id}/review/`, {
        method: "POST",
        body: JSON.stringify(
          scheduleAction
            ? reviewDraft
            : { action: reviewDraft.action, review_notes: reviewDraft.review_notes },
        ),
      });
      toast.success(
        reviewDraft.action === "START_REVIEW"
          ? "Request moved under review."
          : reviewDraft.action === "REJECT"
            ? "Request rejected with a recorded reason."
            : reviewDraft.action === "RESCHEDULE"
              ? "Arrival rescheduled with a new token."
              : "Request approved and capacity reserved.",
      );
      setReviewOpen(false);
      await loadRequests();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function cancelRequest() {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      await apiRequest<ProcurementRequest>(`/procurement-requests/${cancelTarget.id}/cancel/`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason }),
      });
      toast.success("Request cancelled; any reserved capacity was released.");
      setCancelTarget(null);
      setCancelReason("");
      await loadRequests();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadRequests()} />;

  const reviewIsSchedule = reviewDraft?.action === "APPROVE" || reviewDraft?.action === "RESCHEDULE";

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow={isFarmer ? "Sell intent" : "Approval queue"}
        title={isFarmer ? "Procurement requests" : "Review procurement requests"}
        description={
          isFarmer
            ? "Submit crop and quantity details for review. Capacity is reserved only after an officer approves your arrival."
            : "Review requests within your authorised centre scope, reserve daily capacity, and issue arrival tokens."
        }
        action={isFarmer ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-11" disabled={!user.profile_completed || crops.length === 0 || centres.length === 0}>
                <Plus className="size-4" /> New request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
              <form onSubmit={createRequest}>
                <DialogHeader>
                  <DialogTitle>Submit a procurement request</DialogTitle>
                  <DialogDescription>This records your intent to sell. It is not a procurement transaction or receipt.</DialogDescription>
                </DialogHeader>
                <div className="my-6 grid gap-5 sm:grid-cols-2">
                  <FormField label="Crop record" required className="sm:col-span-2">
                    <Select value={draft.farmer_crop} onValueChange={(value) => updateDraft("farmer_crop", value)} required>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select an active crop" /></SelectTrigger>
                      <SelectContent>
                        {crops.map((crop) => (
                          <SelectItem key={crop.id} value={crop.id}>
                            {crop.crop_name} · {crop.season_label} {crop.harvest_year} · {formatKilograms(crop.available_quantity_kg)} available
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Procurement centre" required className="sm:col-span-2">
                    <Select value={draft.procurement_center} onValueChange={(value) => updateDraft("procurement_center", value)} required>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select a centre" /></SelectTrigger>
                      <SelectContent>
                        {centres.map((centre) => (
                          <SelectItem key={centre.id} value={centre.id}>{centre.code} · {centre.name}, {centre.district}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Intended quantity" hint="kg" htmlFor="request-quantity" required>
                    <Input id="request-quantity" type="number" min="0.01" step="0.01" value={draft.intended_quantity_kg} onChange={(event) => updateDraft("intended_quantity_kg", event.target.value)} required />
                  </FormField>
                  <FormField label="Preferred date" htmlFor="request-date" required>
                    <Input id="request-date" type="date" min={nextDateIso(0)} value={draft.preferred_date} onChange={(event) => updateDraft("preferred_date", event.target.value)} required />
                  </FormField>
                  <FormField label="Notes" htmlFor="request-notes" className="sm:col-span-2">
                    <Textarea id="request-notes" maxLength={500} value={draft.farmer_notes} onChange={(event) => updateDraft("farmer_notes", event.target.value)} placeholder="Optional harvest, transport, or accessibility details" />
                  </FormField>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
                    {saving ? "Submitting…" : "Submit request"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      {isFarmer && !user.profile_completed ? (
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            Complete your farmer profile before submitting a request.
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={Clock3} label="Awaiting decision" value={String(metrics.pending)} helper="Submitted or under review" />
        <MetricCard icon={CalendarClock} label="Scheduled" value={String(metrics.scheduled)} helper="Approved arrival slots" />
        <MetricCard icon={Scale} label="Reserved quantity" value={formatKilograms(metrics.reserved)} helper="Backed by active appointments" />
      </section>

      {requests.length === 0 ? (
        <Card className="border-dashed bg-white">
          <CardContent className="py-14 text-center">
            <ClipboardCheck className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="font-medium">{isFarmer ? "No procurement requests yet" : "The review queue is clear"}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              {isFarmer ? "Create a request when an active crop is ready to be scheduled." : "New farmer requests for your authorised centre will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isFarmer={isFarmer}
              canReview={canReview}
              onCancel={() => { setCancelTarget(request); setCancelReason(""); }}
              onReview={() => openReview(request)}
            />
          ))}
        </section>
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          {selectedRequest && reviewDraft ? (
            <form onSubmit={submitReview}>
              <DialogHeader>
                <DialogTitle>Review {selectedRequest.request_number}</DialogTitle>
                <DialogDescription>{selectedRequest.farmer_name} · {selectedRequest.crop_name} · {formatKilograms(selectedRequest.intended_quantity_kg)}</DialogDescription>
              </DialogHeader>
              <div className="my-6 grid gap-5 sm:grid-cols-2">
                <FormField label="Decision" required className="sm:col-span-2">
                  <Select
                    value={reviewDraft.action}
                    onValueChange={(value) => {
                      const action = value as ReviewAction;
                      updateReview("action", action);
                      setCapacity(null);
                      if (action === "APPROVE") void loadCapacity(selectedRequest, reviewDraft.scheduled_date);
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {selectedRequest.status === "SUBMITTED" ? <SelectItem value="START_REVIEW">Start review</SelectItem> : null}
                      {["SUBMITTED", "UNDER_REVIEW"].includes(selectedRequest.status) ? <SelectItem value="APPROVE">Approve and schedule</SelectItem> : null}
                      {["SUBMITTED", "UNDER_REVIEW"].includes(selectedRequest.status) ? <SelectItem value="REJECT">Reject with reason</SelectItem> : null}
                      {["APPROVED", "RESCHEDULED"].includes(selectedRequest.status) ? <SelectItem value="RESCHEDULE">Reschedule and issue new token</SelectItem> : null}
                    </SelectContent>
                  </Select>
                </FormField>
                {reviewIsSchedule ? (
                  <>
                    <FormField label="Arrival date" htmlFor="schedule-date" required className="sm:col-span-2">
                      <Input
                        id="schedule-date"
                        type="date"
                        min={nextDateIso(0)}
                        value={reviewDraft.scheduled_date}
                        onChange={(event) => {
                          updateReview("scheduled_date", event.target.value);
                          setCapacity(null);
                          if (reviewDraft.action === "APPROVE") void loadCapacity(selectedRequest, event.target.value);
                        }}
                        required
                      />
                    </FormField>
                    <FormField label="Slot starts" htmlFor="slot-start" required>
                      <Input id="slot-start" type="time" value={reviewDraft.slot_start_time} onChange={(event) => updateReview("slot_start_time", event.target.value)} required />
                    </FormField>
                    <FormField label="Slot ends" htmlFor="slot-end" required>
                      <Input id="slot-end" type="time" value={reviewDraft.slot_end_time} onChange={(event) => updateReview("slot_end_time", event.target.value)} required />
                    </FormField>
                    <FormField label="Reserved quantity" hint="kg" htmlFor="schedule-quantity" required className="sm:col-span-2">
                      <Input id="schedule-quantity" type="number" min="0.01" step="0.01" value={reviewDraft.quantity_kg} onChange={(event) => updateReview("quantity_kg", event.target.value)} required />
                    </FormField>
                    {capacity && reviewDraft.action === "APPROVE" ? (
                      <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                        <p className="font-medium">{formatKilograms(capacity.available_quantity_kg)} available on {formatDate(capacity.date)}</p>
                        <p className="mt-1 text-xs text-emerald-800">{formatKilograms(capacity.reserved_quantity_kg)} of {formatKilograms(capacity.daily_capacity_kg)} already reserved.</p>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <FormField label={reviewDraft.action === "REJECT" ? "Reason" : "Review notes"} htmlFor="review-notes" required={reviewDraft.action === "REJECT"} className="sm:col-span-2">
                  <Textarea id="review-notes" maxLength={500} value={reviewDraft.review_notes} onChange={(event) => updateReview("review_notes", event.target.value)} placeholder={reviewDraft.action === "REJECT" ? "A reason is required and becomes part of the history." : "Optional decision notes"} required={reviewDraft.action === "REJECT"} />
                </FormField>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReviewOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : reviewDraft.action === "REJECT" ? <XCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                  {saving ? "Saving…" : "Record decision"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={cancelTarget !== null} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {cancelTarget?.request_number}?</AlertDialogTitle>
            <AlertDialogDescription>Any active arrival token and reserved capacity will be cancelled. The request stays in your history.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason *</Label>
            <Textarea id="cancel-reason" minLength={3} maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Why are you cancelling this request?" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep request</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving || cancelReason.trim().length < 3}
              onClick={(event) => { event.preventDefault(); void cancelRequest(); }}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RequestCard({ request, isFarmer, canReview, onCancel, onReview }: { request: ProcurementRequest; isFarmer: boolean; canReview: boolean; onCancel: () => void; onReview: () => void }) {
  const latestEvent = request.status_events.at(-1);
  return (
    <Card className="border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-primary">{request.request_number}</p>
            <CardTitle className="mt-2 text-lg">{request.crop_name}</CardTitle>
            <CardDescription className="mt-1">{isFarmer ? request.center_name : `${request.farmer_name} · ${request.farmer_code}`}</CardDescription>
          </div>
          <StatusBadge status={request.status} label={request.status_label} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Info icon={Scale} label="Intended quantity" value={formatKilograms(request.intended_quantity_kg)} />
          <Info icon={CalendarClock} label="Preferred date" value={formatDate(request.preferred_date)} />
          <Info icon={MapPinned} label="Centre" value={`${request.center_code} · ${request.center_name}`} className="col-span-2" />
        </div>

        {request.appointment ? (
          <div className={`rounded-2xl border p-4 ${request.appointment.status === "SCHEDULED" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50 opacity-70"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Arrival token</p>
                <p className="mt-1 font-mono text-lg font-bold tracking-wide">{request.appointment.token_code}</p>
              </div>
              <Badge variant="outline">Queue #{request.appointment.queue_number}</Badge>
            </div>
            <p className="mt-3 text-sm">{formatDate(request.appointment.scheduled_date)} · {request.appointment.slot_start_time.slice(0, 5)}–{request.appointment.slot_end_time.slice(0, 5)} · {formatKilograms(request.appointment.scheduled_quantity_kg)}</p>
          </div>
        ) : null}

        {latestEvent ? (
          <div className="flex items-start gap-3 border-t pt-4 text-sm text-muted-foreground">
            <History className="mt-0.5 size-4 shrink-0 text-primary" />
            <p><span className="font-medium text-foreground">{latestEvent.to_status_label}</span> by {latestEvent.actor_name}{latestEvent.note ? ` · ${latestEvent.note}` : ""}</p>
          </div>
        ) : null}

        {(request.can_cancel || (canReview && request.can_review)) ? (
          <div className="flex justify-end gap-2 border-t pt-4">
            {isFarmer && request.can_cancel ? <Button variant="outline" onClick={onCancel}>Cancel request</Button> : null}
            {canReview && request.can_review ? <Button onClick={onReview}>{["APPROVED", "RESCHEDULED"].includes(request.status) ? "Reschedule" : "Review request"}</Button> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, label }: { status: ProcurementRequestStatus; label: string }) {
  const styles: Record<ProcurementRequestStatus, string> = {
    SUBMITTED: "border-sky-200 bg-sky-50 text-sky-800",
    UNDER_REVIEW: "border-amber-200 bg-amber-50 text-amber-800",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    RESCHEDULED: "border-violet-200 bg-violet-50 text-violet-800",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
    CANCELLED: "border-slate-200 bg-slate-100 text-slate-700",
    EXPIRED: "border-slate-200 bg-slate-100 text-slate-700",
    CHECKED_IN: "border-cyan-200 bg-cyan-50 text-cyan-800",
    INSPECTION_PASSED: "border-teal-200 bg-teal-50 text-teal-800",
    INSPECTION_REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
    WEIGHED: "border-indigo-200 bg-indigo-50 text-indigo-800",
    PROCURED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    PROCUREMENT_REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
  };
  return <Badge variant="outline" className={styles[status]}>{label}</Badge>;
}

function FormField({ label, htmlFor, hint, required, className, children }: { label: string; htmlFor?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}{required ? " *" : ""}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, helper }: { icon: typeof ClipboardCheck; label: string; value: string; helper: string }) {
  return (
    <Card className="gap-3 border-slate-200 bg-white py-5 shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
      <CardContent className="flex items-start justify-between gap-4 px-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  );
}

function Info({ icon: Icon, label, value, className }: { icon: typeof Scale; label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-start gap-3 ${className ?? ""}`}>
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-medium leading-5">{value}</p></div>
    </div>
  );
}
