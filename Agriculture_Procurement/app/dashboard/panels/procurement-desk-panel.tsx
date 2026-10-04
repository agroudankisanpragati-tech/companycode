"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Loader2,
  LogIn,
  Scale,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatCurrency, formatDate, formatKilograms } from "@/lib/format";
import type { PaginatedResponse, ProcurementAppointment } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

type Draft = {
  transport_mode: string;
  vehicle_number: string;
  arrival_notes: string;
  result: string;
  grade: string;
  moisture_percentage: string;
  foreign_matter_percentage: string;
  damaged_percentage: string;
  sample_reference: string;
  inspection_notes: string;
  rejection_reason: string;
  gross_weight_kg: string;
  tare_weight_kg: string;
  bag_count: string;
  weighbridge_reference: string;
  weighment_notes: string;
  accepted_quantity_kg: string;
  rate_per_kg: string;
  decision_reason: string;
};

const emptyDraft: Draft = {
  transport_mode: "TRACTOR",
  vehicle_number: "",
  arrival_notes: "",
  result: "PASSED",
  grade: "FAQ",
  moisture_percentage: "",
  foreign_matter_percentage: "",
  damaged_percentage: "",
  sample_reference: "",
  inspection_notes: "",
  rejection_reason: "",
  gross_weight_kg: "",
  tare_weight_kg: "",
  bag_count: "",
  weighbridge_reference: "",
  weighment_notes: "",
  accepted_quantity_kg: "",
  rate_per_kg: "",
  decision_reason: "",
};

const actionCopy = {
  CHECK_IN: { title: "Record arrival check-in", button: "Check in farmer", icon: LogIn },
  INSPECT: { title: "Record quality inspection", button: "Save inspection", icon: ShieldCheck },
  WEIGH: { title: "Record weighment", button: "Save weighment", icon: Scale },
  DECIDE: { title: "Record acceptance decision", button: "Complete procurement", icon: BadgeCheck },
} as const;

export function ProcurementDeskPanel() {
  const [appointments, setAppointments] = useState<ProcurementAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProcurementAppointment | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const loadAppointments = useCallback(async () => {
    try {
      const page = await apiRequest<PaginatedResponse<ProcurementAppointment>>(
        "/appointments/?operational=true",
      );
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

  const metrics = useMemo(
    () => ({
      awaiting: appointments.filter((item) => item.next_action === "CHECK_IN").length,
      processing: appointments.filter((item) => item.status === "CHECKED_IN").length,
      reserved: appointments.reduce(
        (total, item) => total + Number(item.scheduled_quantity_kg),
        0,
      ),
    }),
    [appointments],
  );

  function openAction(appointment: ProcurementAppointment) {
    const net = appointment.processing.weighment?.net_weight_kg ?? "";
    setDraft({ ...emptyDraft, accepted_quantity_kg: net });
    setSelected(appointment);
  }

  function updateDraft(field: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!selected || !["CHECK_IN", "INSPECT", "WEIGH", "DECIDE"].includes(selected.next_action)) return;
    setSaving(true);
    try {
      const { path, payload } = actionRequest(selected, draft);
      await apiRequest<ProcurementAppointment>(`/appointments/${selected.id}/${path}/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(successMessage(selected.next_action));
      setSelected(null);
      await loadAppointments();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadAppointments()} />;

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow="Centre operations"
        title="Physical procurement desk"
        description="Advance each approved token through check-in, quality inspection, weighment, and one final acceptance decision. Every saved stage becomes read-only."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Metric icon={LogIn} label="Awaiting check-in" value={String(metrics.awaiting)} helper="Due tokens at the gate" />
        <Metric icon={ClipboardCheck} label="In processing" value={String(metrics.processing)} helper="Checked-in arrivals" />
        <Metric icon={Scale} label="Open allocation" value={formatKilograms(metrics.reserved)} helper="Active arrival reservations" />
      </section>

      {appointments.length === 0 ? (
        <Card className="border-dashed bg-white">
          <CardContent className="py-14 text-center">
            <BadgeCheck className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="font-medium">No arrivals need processing</p>
            <p className="mt-1 text-sm text-muted-foreground">Approved tokens appear here until completed or rejected.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-5 xl:grid-cols-2">
          {appointments.map((appointment) => (
            <DeskCard key={appointment.id} appointment={appointment} onAction={() => openAction(appointment)} />
          ))}
        </section>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
          {selected && selected.next_action in actionCopy ? (
            <ActionForm
              appointment={selected}
              draft={draft}
              saving={saving}
              onChange={updateDraft}
              onSubmit={submitAction}
              onCancel={() => setSelected(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeskCard({ appointment, onAction }: { appointment: ProcurementAppointment; onAction: () => void }) {
  const canAct = appointment.next_action in actionCopy;
  const copy = canAct ? actionCopy[appointment.next_action as keyof typeof actionCopy] : null;
  const ActionIcon = copy?.icon ?? CalendarClock;
  return (
    <Card className="border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
      <CardHeader className="border-b pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-sm font-semibold tracking-wide text-primary">{appointment.token_code}</p>
            <CardTitle className="mt-2 text-xl">{appointment.farmer_name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{appointment.farmer_code} · {appointment.request_number}</p>
          </div>
          <Badge className="bg-emerald-50 text-emerald-800" variant="outline">{appointment.request_status_label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Fact label="Queue" value={`#${appointment.queue_number}`} />
          <Fact label="Date" value={formatDate(appointment.scheduled_date)} />
          <Fact label="Crop" value={appointment.crop_name} />
          <Fact label="Reserved" value={formatKilograms(appointment.scheduled_quantity_kg)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Stage label="Check-in" done={Boolean(appointment.processing.check_in)} />
          <Stage label="Inspection" done={Boolean(appointment.processing.inspection)} />
          <Stage label="Weighment" done={Boolean(appointment.processing.weighment)} />
          <Stage label="Decision" done={Boolean(appointment.processing.decision)} />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/45 p-4">
          <div className="flex items-center gap-3">
            <ActionIcon className="size-5 text-primary" />
            <div>
              <p className="text-sm font-medium">{copy?.title ?? "Scheduled arrival"}</p>
              <p className="text-xs text-muted-foreground">{appointment.center_code} · {appointment.slot_start_time.slice(0, 5)}–{appointment.slot_end_time.slice(0, 5)}</p>
            </div>
          </div>
          <Button onClick={onAction} disabled={!canAct}>
            {copy?.button ?? `Scheduled ${formatDate(appointment.scheduled_date)}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionForm({
  appointment,
  draft,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: {
  appointment: ProcurementAppointment;
  draft: Draft;
  saving: boolean;
  onChange: (field: keyof Draft, value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const copy = actionCopy[appointment.next_action as keyof typeof actionCopy];
  const ActionIcon = copy.icon;
  const net = Number(appointment.processing.weighment?.net_weight_kg ?? 0);
  const accepted = Number(draft.accepted_quantity_kg || 0);
  const rate = Number(draft.rate_per_kg || 0);
  const calculatedNet = Number(draft.gross_weight_kg || 0) - Number(draft.tare_weight_kg || 0);
  return (
    <form onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>
          {appointment.token_code} · {appointment.farmer_name} · {appointment.crop_name} · {formatKilograms(appointment.scheduled_quantity_kg)} reserved
        </DialogDescription>
      </DialogHeader>
      <div className="my-6 grid gap-5 sm:grid-cols-2">
        {appointment.next_action === "CHECK_IN" ? (
          <>
            <Field label="Transport mode" required>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.transport_mode} onChange={(event) => onChange("transport_mode", event.target.value)}>
                <option value="TRACTOR">Tractor</option><option value="TRUCK">Truck</option><option value="PICKUP">Pickup vehicle</option><option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Vehicle number"><Input maxLength={20} value={draft.vehicle_number} onChange={(event) => onChange("vehicle_number", event.target.value)} placeholder="CG 07 AB 1234" /></Field>
            <Field label="Arrival notes" wide><Textarea maxLength={500} value={draft.arrival_notes} onChange={(event) => onChange("arrival_notes", event.target.value)} /></Field>
          </>
        ) : null}
        {appointment.next_action === "INSPECT" ? (
          <>
            <Field label="Inspection result" required>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.result} onChange={(event) => onChange("result", event.target.value)}>
                <option value="PASSED">Passed</option><option value="REJECTED">Rejected</option>
              </select>
            </Field>
            <Field label="Grade" required>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.grade} disabled={draft.result === "REJECTED"} onChange={(event) => onChange("grade", event.target.value)}>
                <option value="FAQ">Fair Average Quality</option><option value="GRADE_A">Grade A</option><option value="GRADE_B">Grade B</option><option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Moisture" hint="%"><Input type="number" min="0" max="100" step="0.01" value={draft.moisture_percentage} onChange={(event) => onChange("moisture_percentage", event.target.value)} /></Field>
            <Field label="Foreign matter" hint="%"><Input type="number" min="0" max="100" step="0.01" value={draft.foreign_matter_percentage} onChange={(event) => onChange("foreign_matter_percentage", event.target.value)} /></Field>
            <Field label="Damaged" hint="%"><Input type="number" min="0" max="100" step="0.01" value={draft.damaged_percentage} onChange={(event) => onChange("damaged_percentage", event.target.value)} /></Field>
            <Field label="Sample reference"><Input maxLength={60} value={draft.sample_reference} onChange={(event) => onChange("sample_reference", event.target.value)} /></Field>
            {draft.result === "REJECTED" ? <Field label="Rejection reason" required wide><Textarea maxLength={500} required value={draft.rejection_reason} onChange={(event) => onChange("rejection_reason", event.target.value)} /></Field> : null}
            <Field label="Inspection notes" wide><Textarea maxLength={500} value={draft.inspection_notes} onChange={(event) => onChange("inspection_notes", event.target.value)} /></Field>
          </>
        ) : null}
        {appointment.next_action === "WEIGH" ? (
          <>
            <Field label="Gross weight" hint="kg" required><Input type="number" min="0.01" step="0.01" required value={draft.gross_weight_kg} onChange={(event) => onChange("gross_weight_kg", event.target.value)} /></Field>
            <Field label="Tare weight" hint="kg" required><Input type="number" min="0" step="0.01" required value={draft.tare_weight_kg} onChange={(event) => onChange("tare_weight_kg", event.target.value)} /></Field>
            <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><strong>Calculated net:</strong> {formatKilograms(Math.max(calculatedNet, 0))}</div>
            <Field label="Bag count"><Input type="number" min="1" step="1" value={draft.bag_count} onChange={(event) => onChange("bag_count", event.target.value)} /></Field>
            <Field label="Weighbridge reference"><Input maxLength={60} value={draft.weighbridge_reference} onChange={(event) => onChange("weighbridge_reference", event.target.value)} /></Field>
            <Field label="Weighment notes" wide><Textarea maxLength={500} value={draft.weighment_notes} onChange={(event) => onChange("weighment_notes", event.target.value)} /></Field>
          </>
        ) : null}
        {appointment.next_action === "DECIDE" ? (
          <>
            <div className="sm:col-span-2 grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 sm:grid-cols-3">
              <Fact label="Net weight" value={formatKilograms(net)} /><Fact label="Rejected" value={formatKilograms(Math.max(net - accepted, 0))} /><Fact label="Amount payable" value={formatCurrency(accepted * rate)} />
            </div>
            <Field label="Accepted quantity" hint="kg" required><Input type="number" min="0" max={Math.min(net, Number(appointment.scheduled_quantity_kg))} step="0.01" required value={draft.accepted_quantity_kg} onChange={(event) => onChange("accepted_quantity_kg", event.target.value)} /></Field>
            <Field label="Rate" hint="₹ per kg" required={accepted > 0}><Input type="number" min="0.01" step="0.01" required={accepted > 0} value={draft.rate_per_kg} onChange={(event) => onChange("rate_per_kg", event.target.value)} /></Field>
            <Field label="Reason / decision notes" hint={accepted < net ? "Required for partial or full rejection" : "Optional for full acceptance"} required={accepted < net} wide><Textarea maxLength={500} required={accepted < net} value={draft.decision_reason} onChange={(event) => onChange("decision_reason", event.target.value)} /></Field>
            <div className="sm:col-span-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Completing this step creates the final procurement transaction only when accepted quantity is positive. The recorded amount is payable, not paid.</div>
          </>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <ActionIcon className="size-4" />}
          {saving ? "Saving immutable record…" : copy.button}
        </Button>
      </DialogFooter>
    </form>
  );
}

function actionRequest(appointment: ProcurementAppointment, draft: Draft) {
  if (appointment.next_action === "CHECK_IN") return { path: "check-in", payload: { transport_mode: draft.transport_mode, vehicle_number: draft.vehicle_number, arrival_notes: draft.arrival_notes } };
  if (appointment.next_action === "INSPECT") return { path: "inspect", payload: compact({ result: draft.result, grade: draft.grade, moisture_percentage: draft.moisture_percentage, foreign_matter_percentage: draft.foreign_matter_percentage, damaged_percentage: draft.damaged_percentage, sample_reference: draft.sample_reference, inspection_notes: draft.inspection_notes, rejection_reason: draft.rejection_reason }) };
  if (appointment.next_action === "WEIGH") return { path: "weigh", payload: compact({ gross_weight_kg: draft.gross_weight_kg, tare_weight_kg: draft.tare_weight_kg, bag_count: draft.bag_count, weighbridge_reference: draft.weighbridge_reference, weighment_notes: draft.weighment_notes }) };
  return { path: "decide", payload: compact({ accepted_quantity_kg: draft.accepted_quantity_kg, rate_per_kg: draft.rate_per_kg, decision_reason: draft.decision_reason }) };
}

function compact(record: Record<string, string>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== ""));
}

function successMessage(action: ProcurementAppointment["next_action"]) {
  if (action === "CHECK_IN") return "Arrival checked in.";
  if (action === "INSPECT") return "Inspection recorded.";
  if (action === "WEIGH") return "Weighment recorded.";
  return "Acceptance decision recorded.";
}

function Field({ label, hint, required, wide, children }: { label: string; hint?: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <label className={`space-y-2 text-sm ${wide ? "sm:col-span-2" : ""}`}><span className="flex items-center justify-between gap-2 font-medium"><span>{label}{required ? <span className="text-destructive"> *</span> : null}</span>{hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}</span>{children}</label>;
}

function Metric({ icon: Icon, label, value, helper }: { icon: typeof Truck; label: string; value: string; helper: string }) {
  return <Card className="border-slate-200 bg-white py-5 shadow-[0_8px_30px_rgba(15,58,52,0.05)]"><CardContent className="flex items-start justify-between gap-4 px-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div></CardContent></Card>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}

function Stage({ label, done }: { label: string; done: boolean }) {
  return <Badge variant="outline" className={done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-500"}>{done ? "✓ " : ""}{label}</Badge>;
}
