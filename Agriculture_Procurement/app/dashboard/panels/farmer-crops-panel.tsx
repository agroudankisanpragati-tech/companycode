"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CalendarDays, Loader2, Plus, Scale, Sprout, Wheat } from "lucide-react";
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
  AlertDialogTrigger,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import { formatDate, formatKilograms, formatNumber } from "@/lib/format";
import type { CropCatalogueItem, CropSeason, FarmerCrop, PaginatedResponse } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

const seasons: Array<{ value: CropSeason; label: string }> = [
  { value: "KHARIF", label: "Kharif" },
  { value: "RABI", label: "Rabi" },
  { value: "ZAID", label: "Zaid" },
  { value: "PERENNIAL", label: "Perennial" },
];

type CropDraft = {
  crop: string;
  season: CropSeason;
  harvest_year: string;
  cultivated_area_acres: string;
  estimated_quantity_kg: string;
  available_quantity_kg: string;
  harvest_date: string;
  notes: string;
};

function newCropDraft(): CropDraft {
  return {
    crop: "",
    season: "KHARIF",
    harvest_year: String(new Date().getFullYear()),
    cultivated_area_acres: "",
    estimated_quantity_kg: "",
    available_quantity_kg: "",
    harvest_date: "",
    notes: "",
  };
}

export function FarmerCropsPanel() {
  const [crops, setCrops] = useState<FarmerCrop[]>([]);
  const [catalogue, setCatalogue] = useState<CropCatalogueItem[]>([]);
  const [draft, setDraft] = useState<CropDraft>(newCropDraft);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCrops = useCallback(async () => {
    try {
      const [cropPage, cataloguePage] = await Promise.all([
        apiRequest<PaginatedResponse<FarmerCrop>>("/farmer-crops/"),
        apiRequest<PaginatedResponse<CropCatalogueItem>>("/crop-catalogue/"),
      ]);
      setCrops(cropPage.results);
      setCatalogue(cataloguePage.results);
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
    void loadCrops();
  }, [loadCrops]);

  const activeCrops = useMemo(() => crops.filter((crop) => crop.is_active), [crops]);
  const availableQuantity = useMemo(
    () => activeCrops.reduce((total, crop) => total + Number(crop.available_quantity_kg), 0),
    [activeCrops],
  );

  function update<K extends keyof CropDraft>(field: K, value: CropDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function addCrop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest<FarmerCrop>("/farmer-crops/", {
        method: "POST",
        body: JSON.stringify({
          ...draft,
          harvest_year: Number(draft.harvest_year),
          available_quantity_kg: draft.available_quantity_kg || draft.estimated_quantity_kg,
          harvest_date: draft.harvest_date || null,
        }),
      });
      toast.success("Crop record added.");
      setDialogOpen(false);
      setDraft(newCropDraft());
      await loadCrops();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function archiveCrop(crop: FarmerCrop) {
    setArchiving(crop.id);
    try {
      await apiRequest<FarmerCrop>(`/farmer-crops/${crop.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: false }),
      });
      toast.success(`${crop.crop_name} archived.`);
      await loadCrops();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setArchiving(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadCrops()} />;

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow="Crop readiness"
        title="My crop records"
        description="Register what you cultivate and the quantity currently available. These records remain private to your account."
        action={(
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11" disabled={catalogue.length === 0}>
                <Plus className="size-4" /> Add crop
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
              <form onSubmit={addCrop}>
                <DialogHeader>
                  <DialogTitle>Add a crop record</DialogTitle>
                  <DialogDescription>Use an approved catalogue crop and report quantities in kilograms.</DialogDescription>
                </DialogHeader>
                <div className="my-6 grid gap-5 sm:grid-cols-2">
                  <FormField label="Crop" required>
                    <Select value={draft.crop} onValueChange={(value) => update("crop", value)} required>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select crop" /></SelectTrigger>
                      <SelectContent>
                        {catalogue.map((crop) => (
                          <SelectItem key={crop.id} value={crop.id}>{crop.name}{crop.name_hi ? ` · ${crop.name_hi}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Season" required>
                    <Select value={draft.season} onValueChange={(value) => update("season", value as CropSeason)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{seasons.map((season) => <SelectItem key={season.value} value={season.value}>{season.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Harvest year" htmlFor="crop-year" required>
                    <Input id="crop-year" type="number" min="2000" max={new Date().getFullYear() + 1} value={draft.harvest_year} onChange={(event) => update("harvest_year", event.target.value)} required />
                  </FormField>
                  <FormField label="Cultivated area" htmlFor="crop-area" hint="acres" required>
                    <Input id="crop-area" type="number" min="0.01" step="0.01" value={draft.cultivated_area_acres} onChange={(event) => update("cultivated_area_acres", event.target.value)} required />
                  </FormField>
                  <FormField label="Estimated quantity" htmlFor="crop-estimated" hint="kg" required>
                    <Input id="crop-estimated" type="number" min="0.01" step="0.01" value={draft.estimated_quantity_kg} onChange={(event) => update("estimated_quantity_kg", event.target.value)} required />
                  </FormField>
                  <FormField label="Available quantity" htmlFor="crop-available" hint="kg · defaults to estimate">
                    <Input id="crop-available" type="number" min="0" step="0.01" value={draft.available_quantity_kg} onChange={(event) => update("available_quantity_kg", event.target.value)} />
                  </FormField>
                  <FormField label="Expected harvest date" htmlFor="crop-date">
                    <Input id="crop-date" type="date" value={draft.harvest_date} onChange={(event) => update("harvest_date", event.target.value)} />
                  </FormField>
                  <FormField label="Notes" htmlFor="crop-notes" className="sm:col-span-2">
                    <Textarea id="crop-notes" maxLength={500} value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional crop quality or harvest notes" />
                  </FormField>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {saving ? "Adding…" : "Add crop"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={Sprout} label="Active records" value={String(activeCrops.length)} helper="Available for new requests" />
        <MetricCard icon={Scale} label="Available quantity" value={formatKilograms(availableQuantity)} helper="Across active records" />
        <MetricCard icon={CalendarDays} label="Seasons represented" value={String(new Set(activeCrops.map((crop) => crop.season)).size)} helper="Current crop portfolio" />
      </section>

      <Card className="border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
        <CardHeader className="border-b">
          <CardTitle>Registered crops</CardTitle>
          <CardDescription>A crop record supports procurement requests; it is not a procurement transaction.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Crop</TableHead>
                <TableHead>Season</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Harvest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-44 text-center">
                    <Wheat className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                    <p className="font-medium">No crop records yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">Add your first catalogue crop to prepare for procurement requests.</p>
                  </TableCell>
                </TableRow>
              ) : crops.map((crop) => (
                <TableRow key={crop.id} className={!crop.is_active ? "opacity-60" : undefined}>
                  <TableCell className="pl-6 font-medium">
                    {crop.crop_name}
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{crop.crop_code} · {crop.harvest_year}</span>
                  </TableCell>
                  <TableCell>{crop.season_label}</TableCell>
                  <TableCell>{formatNumber(crop.cultivated_area_acres)} ac</TableCell>
                  <TableCell>{formatKilograms(crop.available_quantity_kg)}</TableCell>
                  <TableCell>{formatDate(crop.harvest_date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={crop.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground"}>
                      {crop.is_active ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {crop.is_active ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" disabled={archiving === crop.id}>
                            <Archive className="size-4" /> Archive
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archive {crop.crop_name}?</AlertDialogTitle>
                            <AlertDialogDescription>The record stays in your history but cannot be used for a new request.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep active</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => void archiveCrop(crop)}>Archive crop</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : <span className="text-xs text-muted-foreground">No actions</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
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

function MetricCard({ icon: Icon, label, value, helper }: { icon: typeof Wheat; label: string; value: string; helper: string }) {
  return (
    <Card className="gap-3 border-slate-200 bg-white py-5 shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
      <CardContent className="flex items-start justify-between gap-4 px-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></div>
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  );
}
