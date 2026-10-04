"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Languages, Layers3, Loader2, Plus, Wheat } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import type { CropCatalogueItem, CropCategory, PaginatedResponse } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

const categories: Array<{ value: CropCategory; label: string }> = [
  { value: "CEREAL", label: "Cereal" },
  { value: "PULSE", label: "Pulse" },
  { value: "OILSEED", label: "Oilseed" },
  { value: "MILLET", label: "Millet" },
  { value: "COMMERCIAL", label: "Commercial crop" },
  { value: "OTHER", label: "Other" },
];

type CatalogueDraft = {
  code: string;
  name: string;
  name_hi: string;
  category: CropCategory;
};

const blankCrop: CatalogueDraft = { code: "", name: "", name_hi: "", category: "CEREAL" };

export function CropCataloguePanel() {
  const [crops, setCrops] = useState<CropCatalogueItem[]>([]);
  const [draft, setDraft] = useState<CatalogueDraft>(blankCrop);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCatalogue = useCallback(async () => {
    try {
      const page = await apiRequest<PaginatedResponse<CropCatalogueItem>>("/crop-catalogue/");
      setCrops(page.results);
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
    void loadCatalogue();
  }, [loadCatalogue]);

  const activeCrops = useMemo(() => crops.filter((crop) => crop.is_active), [crops]);
  const translatedCrops = useMemo(() => crops.filter((crop) => crop.name_hi.trim().length > 0), [crops]);

  function update<K extends keyof CatalogueDraft>(field: K, value: CatalogueDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function addCatalogueCrop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest<CropCatalogueItem>("/crop-catalogue/", {
        method: "POST",
        body: JSON.stringify({ ...draft, code: draft.code.toUpperCase() }),
      });
      toast.success("Catalogue crop created.");
      setDialogOpen(false);
      setDraft(blankCrop);
      await loadCatalogue();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(crop: CropCatalogueItem, isActive: boolean) {
    setChanging(crop.id);
    try {
      await apiRequest<CropCatalogueItem>(`/crop-catalogue/${crop.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      toast.success(`${crop.name} ${isActive ? "activated" : "archived"}.`);
      await loadCatalogue();
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setChanging(null);
    }
  }

  if (loading) return <PanelLoading />;
  if (error) return <PanelError message={error} onRetry={() => void loadCatalogue()} />;

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow="Reference data"
        title="Crop catalogue"
        description="Maintain the approved crops farmers can select. Archiving a crop preserves existing records while blocking new selection."
        action={(
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button className="h-11"><Plus className="size-4" /> Add catalogue crop</Button></DialogTrigger>
            <DialogContent>
              <form onSubmit={addCatalogueCrop}>
                <DialogHeader>
                  <DialogTitle>Add catalogue crop</DialogTitle>
                  <DialogDescription>Create a controlled crop option for farmer records.</DialogDescription>
                </DialogHeader>
                <div className="my-6 grid gap-5 sm:grid-cols-2">
                  <FormField label="Crop code" htmlFor="catalogue-code" required>
                    <Input id="catalogue-code" value={draft.code} onChange={(event) => update("code", event.target.value.toUpperCase())} required maxLength={20} placeholder="PADDY" />
                  </FormField>
                  <FormField label="Category" required>
                    <Select value={draft.category} onValueChange={(value) => update("category", value as CropCategory)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{categories.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="English name" htmlFor="catalogue-name" required>
                    <Input id="catalogue-name" value={draft.name} onChange={(event) => update("name", event.target.value)} required maxLength={100} placeholder="Paddy" />
                  </FormField>
                  <FormField label="Hindi name" htmlFor="catalogue-name-hi">
                    <Input id="catalogue-name-hi" value={draft.name_hi} onChange={(event) => update("name_hi", event.target.value)} maxLength={100} placeholder="धान" />
                  </FormField>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {saving ? "Creating…" : "Create crop"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={BookOpenCheck} label="Catalogue records" value={String(crops.length)} />
        <MetricCard icon={Wheat} label="Active choices" value={String(activeCrops.length)} />
        <MetricCard icon={Languages} label="Hindi labels" value={`${translatedCrops.length}/${crops.length}`} />
      </section>

      <Card className="border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
        <CardHeader className="border-b">
          <CardTitle>Approved crop records</CardTitle>
          <CardDescription>All quantities created from this catalogue use kilograms as their canonical unit.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Code</TableHead>
                <TableHead>English name</TableHead>
                <TableHead>Hindi name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="pr-6">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crops.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-44 text-center">
                    <Layers3 className="mx-auto mb-3 size-8 text-muted-foreground/40" />
                    <p className="font-medium">The crop catalogue is empty</p>
                    <p className="mt-1 text-sm text-muted-foreground">Create the first approved crop before farmers register availability.</p>
                  </TableCell>
                </TableRow>
              ) : crops.map((crop) => (
                <TableRow key={crop.id} className={!crop.is_active ? "opacity-60" : undefined}>
                  <TableCell className="pl-6"><Badge variant="outline">{crop.code}</Badge></TableCell>
                  <TableCell className="font-medium">{crop.name}</TableCell>
                  <TableCell lang="hi">{crop.name_hi || "—"}</TableCell>
                  <TableCell>{crop.category_label}</TableCell>
                  <TableCell>{crop.unit}</TableCell>
                  <TableCell className="pr-6">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={crop.is_active}
                        disabled={changing === crop.id}
                        aria-label={`${crop.is_active ? "Archive" : "Activate"} ${crop.name}`}
                        onCheckedChange={(checked) => void changeStatus(crop, checked)}
                      />
                      <span className="text-xs text-muted-foreground">{crop.is_active ? "Active" : "Archived"}</span>
                    </div>
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

function FormField({ label, htmlFor, required, children }: { label: string; htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={htmlFor}>{label}{required ? " *" : ""}</Label>{children}</div>;
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Wheat; label: string; value: string }) {
  return (
    <Card className="gap-3 border-slate-200 bg-white py-5 shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
      <CardContent className="flex items-center justify-between gap-4 px-5">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div>
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
      </CardContent>
    </Card>
  );
}
