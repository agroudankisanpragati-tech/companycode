"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Clock3, Loader2, MapPinned, Plus, Scale, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatKilograms } from "@/lib/format";
import type { CenterType, PaginatedResponse, ProcurementCenter, UserRole } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

const centerTypes: Array<{ value: CenterType; label: string }> = [
  { value: "PACS", label: "Primary Agricultural Credit Society" },
  { value: "MANDI", label: "Agricultural Market (Mandi)" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "OTHER", label: "Other" },
];

type CenterDraft = {
  code: string;
  name: string;
  center_type: CenterType;
  address_line: string;
  village_or_city: string;
  block: string;
  district: string;
  state: string;
  pincode: string;
  contact_phone: string;
  daily_capacity_kg: string;
  operating_start_time: string;
  operating_end_time: string;
};

const blankCenter: CenterDraft = {
  code: "",
  name: "",
  center_type: "PACS",
  address_line: "",
  village_or_city: "",
  block: "",
  district: "",
  state: "Chhattisgarh",
  pincode: "",
  contact_phone: "",
  daily_capacity_kg: "",
  operating_start_time: "09:00",
  operating_end_time: "17:00",
};

export function CentresPanel({ role }: { role: UserRole }) {
  const [centres, setCentres] = useState<ProcurementCenter[]>([]);
  const [draft, setDraft] = useState<CenterDraft>(blankCenter);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === "ADMIN";
  const loadCentres = useCallback(async () => {
    try {
      const page = await apiRequest<PaginatedResponse<ProcurementCenter>>("/centres/");
      setCentres(page.results);
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
    void loadCentres();
  }, [loadCentres]);

  const activeCentres = useMemo(() => centres.filter((centre) => centre.is_active), [centres]);
  const totalCapacity = useMemo(
    () => activeCentres.reduce((total, centre) => total + Number(centre.daily_capacity_kg), 0),
    [activeCentres],
  );

  function update<K extends keyof CenterDraft>(field: K, value: CenterDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function addCentre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest<ProcurementCenter>("/centres/", {
        method: "POST",
        body: JSON.stringify({ ...draft, code: draft.code.toUpperCase() }),
      });
      toast.success("Procurement centre created.");
      setDialogOpen(false);
      setDraft(blankCenter);
      await loadCentres();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(centre: ProcurementCenter, isActive: boolean) {
    setChanging(centre.id);
    try {
      await apiRequest<ProcurementCenter>(`/centres/${centre.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      toast.success(`${centre.name} ${isActive ? "activated" : "deactivated"}.`);
      await loadCentres();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setChanging(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadCentres()} />;

  const description = role === "FARMER"
    ? "Browse active collection locations. Centre selection becomes available when procurement requests launch."
    : role === "PROCUREMENT_OFFICER"
      ? "Only your administrator-assigned procurement centre is visible in this workspace."
      : "Create operational locations, set daily capacity, and control whether a centre is available.";

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow={role === "PROCUREMENT_OFFICER" ? "Assigned location" : "Procurement network"}
        title={role === "PROCUREMENT_OFFICER" ? "My procurement centre" : "Procurement centres"}
        description={description}
        action={isAdmin ? (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="h-11"><Plus className="size-4" /> Add centre</Button></DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
              <form onSubmit={addCentre}>
                <DialogHeader>
                  <DialogTitle>Create procurement centre</DialogTitle>
                  <DialogDescription>Configure the centre identity, location, capacity, and operating window.</DialogDescription>
                </DialogHeader>
                <div className="my-6 grid gap-5 sm:grid-cols-2">
                  <FormField label="Centre code" htmlFor="centre-code" required>
                    <Input id="centre-code" value={draft.code} onChange={(event) => update("code", event.target.value.toUpperCase())} required maxLength={20} placeholder="DURG-PACS-01" />
                  </FormField>
                  <FormField label="Centre name" htmlFor="centre-name" required>
                    <Input id="centre-name" value={draft.name} onChange={(event) => update("name", event.target.value)} required maxLength={160} />
                  </FormField>
                  <FormField label="Centre type" required>
                    <Select value={draft.center_type} onValueChange={(value) => update("center_type", value as CenterType)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{centerTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Daily capacity" htmlFor="centre-capacity" hint="kg" required>
                    <Input id="centre-capacity" type="number" min="1" step="0.01" value={draft.daily_capacity_kg} onChange={(event) => update("daily_capacity_kg", event.target.value)} required />
                  </FormField>
                  <FormField label="Address" htmlFor="centre-address" className="sm:col-span-2" required>
                    <Input id="centre-address" value={draft.address_line} onChange={(event) => update("address_line", event.target.value)} required maxLength={220} />
                  </FormField>
                  <FormField label="Village or city" htmlFor="centre-locality" required>
                    <Input id="centre-locality" value={draft.village_or_city} onChange={(event) => update("village_or_city", event.target.value)} required maxLength={120} />
                  </FormField>
                  <FormField label="Block" htmlFor="centre-block">
                    <Input id="centre-block" value={draft.block} onChange={(event) => update("block", event.target.value)} maxLength={120} />
                  </FormField>
                  <FormField label="District" htmlFor="centre-district" required>
                    <Input id="centre-district" value={draft.district} onChange={(event) => update("district", event.target.value)} required maxLength={120} />
                  </FormField>
                  <FormField label="State" htmlFor="centre-state" required>
                    <Input id="centre-state" value={draft.state} onChange={(event) => update("state", event.target.value)} required maxLength={120} />
                  </FormField>
                  <FormField label="PIN code" htmlFor="centre-pincode" required>
                    <Input id="centre-pincode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={draft.pincode} onChange={(event) => update("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))} required />
                  </FormField>
                  <FormField label="Contact mobile" htmlFor="centre-phone">
                    <Input id="centre-phone" inputMode="tel" pattern="[6-9][0-9]{9}" maxLength={10} value={draft.contact_phone} onChange={(event) => update("contact_phone", event.target.value.replace(/\D/g, "").slice(0, 10))} />
                  </FormField>
                  <FormField label="Opens" htmlFor="centre-opens" required>
                    <Input id="centre-opens" type="time" value={draft.operating_start_time} onChange={(event) => update("operating_start_time", event.target.value)} required />
                  </FormField>
                  <FormField label="Closes" htmlFor="centre-closes" required>
                    <Input id="centre-closes" type="time" value={draft.operating_end_time} onChange={(event) => update("operating_end_time", event.target.value)} required />
                  </FormField>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {saving ? "Creating…" : "Create centre"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        ) : undefined}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={Building2} label="Visible centres" value={String(centres.length)} />
        <MetricCard icon={ShieldCheck} label="Active centres" value={String(activeCentres.length)} />
        <MetricCard icon={Scale} label="Active daily capacity" value={formatKilograms(totalCapacity)} />
      </section>

      {centres.length === 0 ? (
        <Card className="border-dashed bg-white">
          <CardContent className="py-12 text-center">
            <MapPinned className="mx-auto mb-3 size-9 text-muted-foreground/40" />
            <p className="font-medium">{role === "PROCUREMENT_OFFICER" ? "No centre assigned" : "No procurement centres available"}</p>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
              {role === "PROCUREMENT_OFFICER" ? "Ask an administrator to create your active centre assignment." : "An administrator needs to configure the first operational location."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {centres.map((centre) => (
            <Card key={centre.id} className={`border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)] ${!centre.is_active ? "opacity-65" : ""}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge variant="outline" className="mb-3">{centre.code}</Badge>
                    <CardTitle className="text-lg leading-6">{centre.name}</CardTitle>
                    <CardDescription className="mt-1">{centre.center_type_label}</CardDescription>
                  </div>
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5" /></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <InfoRow icon={MapPinned}>{centre.address_line}, {centre.village_or_city}, {centre.district}, {centre.state} {centre.pincode}</InfoRow>
                <InfoRow icon={Scale}>{formatKilograms(centre.daily_capacity_kg)} daily capacity</InfoRow>
                <InfoRow icon={Clock3}>{centre.operating_start_time.slice(0, 5)}–{centre.operating_end_time.slice(0, 5)}</InfoRow>
                <div className="flex items-center justify-between border-t pt-4">
                  <div>
                    <p className="font-medium">{centre.is_active ? "Active" : "Inactive"}</p>
                    <p className="text-xs text-muted-foreground">{isAdmin ? "Farmer visibility" : "Operational status"}</p>
                  </div>
                  {isAdmin ? (
                    <Switch
                      checked={centre.is_active}
                      disabled={changing === centre.id}
                      aria-label={`${centre.is_active ? "Deactivate" : "Activate"} ${centre.name}`}
                      onCheckedChange={(checked) => void changeStatus(centre, checked)}
                    />
                  ) : (
                    <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-800">Available</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
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

function MetricCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <Card className="gap-3 border-slate-200 bg-white py-5 shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
      <CardContent className="flex items-center justify-between gap-4 px-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div>
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof MapPinned; children: React.ReactNode }) {
  return <div className="flex items-start gap-3 text-muted-foreground"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><span className="leading-6">{children}</span></div>;
}
