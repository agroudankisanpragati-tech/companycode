"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, IdCard, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import type { FarmerProfile } from "@/lib/types";

import { PanelError, PanelHeader, PanelLoading } from "./panel-state";

type ProfileDraft = Pick<
  FarmerProfile,
  "village" | "gram_panchayat" | "block" | "district" | "state" | "pincode"
> & { land_area_acres: string };

const emptyDraft: ProfileDraft = {
  village: "",
  gram_panchayat: "",
  block: "",
  district: "",
  state: "Chhattisgarh",
  pincode: "",
  land_area_acres: "",
};

export function FarmerProfilePanel({ onProfileSaved }: { onProfileSaved?: () => void } = {}) {
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const nextProfile = await apiRequest<FarmerProfile>("/auth/farmer-profile/");
      setProfile(nextProfile);
      setError(null);
      setDraft({
        village: nextProfile.village,
        gram_panchayat: nextProfile.gram_panchayat,
        block: nextProfile.block,
        district: nextProfile.district,
        state: nextProfile.state,
        pincode: nextProfile.pincode,
        land_area_acres: nextProfile.land_area_acres ?? "",
      });
    } catch (caught) {
      setError(getApiErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Client-only API hydration; state updates occur after the API promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  function update<K extends keyof ProfileDraft>(field: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await apiRequest<FarmerProfile>("/auth/farmer-profile/", {
        method: "PATCH",
        body: JSON.stringify({
          ...draft,
          land_area_acres: draft.land_area_acres || null,
        }),
      });
      setProfile(updated);
      onProfileSaved?.();
      toast.success(updated.is_complete ? "Farmer profile completed." : "Farmer profile saved.");
    } catch (caught) {
      toast.error(getApiErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PanelLoading />;
  if (error || !profile) {
    return <PanelError message={error ?? "Farmer profile is unavailable."} onRetry={() => void loadProfile()} />;
  }

  return (
    <div className="space-y-7">
      <PanelHeader
        eyebrow="Farmer identity"
        title="Your farmer profile"
        description="Keep the location and land details used to validate your future procurement requests accurate."
        action={profile.is_complete ? (
          <Badge className="border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
            <CheckCircle2 /> Profile complete
          </Badge>
        ) : (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 px-3 py-1 text-amber-800">
            Profile incomplete
          </Badge>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
        <Card className="h-fit border-slate-200 bg-[#0b3b35] text-white shadow-[0_12px_36px_rgba(11,59,53,0.16)]">
          <CardHeader>
            <div className="mb-2 grid size-11 place-items-center rounded-xl bg-white/10 text-[#f2c45c]">
              <IdCard className="size-5" />
            </div>
            <CardTitle className="text-xl">Registered identity</CardTitle>
            <CardDescription className="text-emerald-50/70">System-issued details cannot be changed here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <IdentityRow label="Farmer code" value={profile.farmer_code} />
            <IdentityRow label="Name" value={profile.farmer_name} />
            <IdentityRow label="Email" value={profile.email} />
            <IdentityRow label="Mobile" value={profile.phone_number ?? "Not recorded"} />
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-emerald-50/75">
              <ShieldCheck className="mb-2 size-5 text-[#f2c45c]" />
              Crop records created from this account stay private to you and authorised administrators.
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,58,52,0.05)]">
          <CardHeader className="border-b">
            <CardTitle>Farm and address details</CardTitle>
            <CardDescription>Fields marked required determine whether your profile is complete.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5 sm:grid-cols-2" onSubmit={saveProfile}>
              <Field label="Village" htmlFor="profile-village" required>
                <Input id="profile-village" value={draft.village} onChange={(event) => update("village", event.target.value)} required maxLength={120} />
              </Field>
              <Field label="Gram panchayat" htmlFor="profile-panchayat">
                <Input id="profile-panchayat" value={draft.gram_panchayat} onChange={(event) => update("gram_panchayat", event.target.value)} maxLength={120} />
              </Field>
              <Field label="Block" htmlFor="profile-block">
                <Input id="profile-block" value={draft.block} onChange={(event) => update("block", event.target.value)} maxLength={120} />
              </Field>
              <Field label="District" htmlFor="profile-district" required>
                <Input id="profile-district" value={draft.district} onChange={(event) => update("district", event.target.value)} required maxLength={120} />
              </Field>
              <Field label="State" htmlFor="profile-state" required>
                <Input id="profile-state" value={draft.state} onChange={(event) => update("state", event.target.value)} required maxLength={120} />
              </Field>
              <Field label="PIN code" htmlFor="profile-pincode" required hint="6 digits">
                <Input id="profile-pincode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={draft.pincode} onChange={(event) => update("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))} required />
              </Field>
              <Field label="Land area" htmlFor="profile-land-area" required hint="acres">
                <Input id="profile-land-area" type="number" inputMode="decimal" min="0.01" step="0.01" value={draft.land_area_acres} onChange={(event) => update("land_area_acres", event.target.value)} required />
              </Field>
              <div className="flex items-end sm:justify-end">
                <Button type="submit" className="h-10 w-full sm:w-auto" disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/10 pb-4 last:border-0 last:pb-0">
      <p className="text-xs uppercase tracking-[0.12em] text-emerald-50/55">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  required = false,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}{required ? " *" : ""}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
