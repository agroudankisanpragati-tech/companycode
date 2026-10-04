"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardCheck,
  Gauge,
  Leaf,
  ListChecks,
  LockKeyhole,
  LogOut,
  MapPinned,
  MessageSquareWarning,
  RefreshCw,
  Scale,
  ShieldCheck,
  UserRoundCheck,
  Wheat,
  type LucideIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { apiRequest, getApiErrorMessage } from "@/lib/api";
import type { DappUser, UserRole } from "@/lib/types";

import type { DashboardView } from "./dashboard-types";
import { AppointmentsPanel } from "./panels/appointments-panel";
import { CentresPanel } from "./panels/centres-panel";
import { CropCataloguePanel } from "./panels/crop-catalogue-panel";
import { FarmerCropsPanel } from "./panels/farmer-crops-panel";
import { FarmerProfilePanel } from "./panels/farmer-profile-panel";
import { OverviewPanel } from "./panels/overview-panel";
import { ProcurementRequestsPanel } from "./panels/procurement-requests-panel";
import { ProcurementDeskPanel } from "./panels/procurement-desk-panel";
import { TransactionsPanel } from "./panels/transactions-panel";
import { AnalyticsPanel } from "./panels/analytics-panel";
import { GrievancesPanel } from "./panels/grievances-panel";
import { NotificationsPanel } from "./panels/notifications-panel";
import { PaymentsPanel } from "./panels/payments-panel";

const roleLabels: Record<UserRole, string> = {
  FARMER: "Farmer",
  PROCUREMENT_OFFICER: "Procurement Officer",
  ADMIN: "Administrator",
};

type NavigationItem = {
  label: string;
  icon: LucideIcon;
  view?: DashboardView;
};

const roleNavigation: Record<UserRole, { ready: NavigationItem[]; future: NavigationItem[] }> = {
  FARMER: {
    ready: [
      { label: "Overview", icon: Gauge, view: "overview" },
      { label: "Farmer profile", icon: UserRoundCheck, view: "farmer-profile" },
      { label: "My crops", icon: Wheat, view: "farmer-crops" },
      { label: "Procurement centres", icon: MapPinned, view: "centres" },
      { label: "Procurement requests", icon: ClipboardCheck, view: "procurement-requests" },
      { label: "Tokens & slots", icon: CalendarClock, view: "appointments" },
      { label: "Procurement history", icon: ListChecks, view: "procurement-records" },
      { label: "Payments", icon: CircleDollarSign, view: "payments" },
      { label: "Notifications", icon: Bell, view: "notifications" },
      { label: "Grievances", icon: MessageSquareWarning, view: "grievances" },
    ],
    future: [
      { label: "Government integrations", icon: ShieldCheck },
    ],
  },
  PROCUREMENT_OFFICER: {
    ready: [
      { label: "Overview", icon: Gauge, view: "overview" },
      { label: "My centre", icon: Building2, view: "centres" },
      { label: "Request queue", icon: ClipboardCheck, view: "procurement-requests" },
      { label: "Procurement desk", icon: Scale, view: "procurement-desk" },
      { label: "Procurement records", icon: ListChecks, view: "procurement-records" },
      { label: "Payments", icon: CircleDollarSign, view: "payments" },
      { label: "Notifications", icon: Bell, view: "notifications" },
      { label: "Grievances", icon: MessageSquareWarning, view: "grievances" },
      { label: "Analytics", icon: BarChart3, view: "analytics" },
    ],
    future: [
      { label: "Government integrations", icon: ShieldCheck },
    ],
  },
  ADMIN: {
    ready: [
      { label: "Overview", icon: Gauge, view: "overview" },
      { label: "Procurement centres", icon: Building2, view: "centres" },
      { label: "Crop catalogue", icon: BookOpenCheck, view: "crop-catalogue" },
      { label: "Procurement requests", icon: ClipboardCheck, view: "procurement-requests" },
      { label: "Appointments", icon: CalendarClock, view: "appointments" },
      { label: "Procurement desk", icon: Scale, view: "procurement-desk" },
      { label: "Procurement records", icon: ListChecks, view: "procurement-records" },
      { label: "Payments", icon: CircleDollarSign, view: "payments" },
      { label: "Notifications", icon: Bell, view: "notifications" },
      { label: "Grievances", icon: MessageSquareWarning, view: "grievances" },
      { label: "Analytics", icon: BarChart3, view: "analytics" },
    ],
    future: [
      { label: "Government integrations", icon: ShieldCheck },
    ],
  },
};

type LoadState = "loading" | "ready" | "error";

export function DashboardClient() {
  const [user, setUser] = useState<DappUser | null>(null);
  const [activeView, setActiveView] = useState<DashboardView>("overview");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    try {
      const currentUser = await apiRequest<DappUser>("/auth/me/");
      setUser(currentUser);
      setError(null);
      setLoadState("ready");
    } catch (caught) {
      const message = getApiErrorMessage(caught);
      if (message === "Authentication required.") {
        window.location.replace("/");
        return;
      }
      setError(message);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    // Client-only session hydration; state updates occur after the API promise settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUser();
  }, [loadUser]);

  const navigation = useMemo(() => roleNavigation[user?.role ?? "FARMER"], [user?.role]);

  async function logout() {
    try {
      await apiRequest("/auth/logout/", { method: "POST" }, false);
    } finally {
      window.location.replace("/");
    }
  }

  if (loadState === "loading") {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/40 px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-12 animate-pulse place-items-center rounded-2xl bg-primary text-primary-foreground"><Leaf className="size-6" /></div>
          <p className="font-medium">Opening your DAPP dashboard…</p>
          <p className="mt-1 text-sm text-muted-foreground">Verifying your secure session</p>
        </div>
      </main>
    );
  }

  if (loadState === "error" || !user) {
    return (
      <main className="grid min-h-svh place-items-center bg-muted/40 px-6">
        <Alert className="max-w-lg border-amber-300 bg-amber-50 text-amber-950">
          <AlertTitle>Dashboard temporarily unavailable</AlertTitle>
          <AlertDescription className="mt-2 leading-6">
            {error}
            <Button variant="outline" className="mt-5 w-full border-amber-300 bg-white" onClick={() => void loadUser()}>
              <RefreshCw className="size-4" /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const displayName = `${user.first_name} ${user.last_name}`.trim() || user.email;
  const activeLabel = navigation.ready.find((item) => item.view === activeView)?.label ?? "Overview";

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Leaf className="size-5" /></div>
            <div className="min-w-0">
              <p className="font-bold tracking-tight">DAPP</p>
              <p className="truncate text-xs text-sidebar-foreground/60">Procurement portal</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.ready.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      isActive={activeView === item.view}
                      tooltip={item.label}
                      onClick={() => item.view && setActiveView(item.view)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Future roadmap</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.future.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton disabled tooltip={`${item.label} · future roadmap`}>
                      <item.icon />
                      <span>{item.label}</span>
                      <LockKeyhole className="ml-auto size-3.5 opacity-50" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-accent font-semibold text-sidebar-accent-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{roleLabels[user.role]}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={() => void logout()}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-svh bg-[#f7faf8]">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#102a27]">{activeLabel}</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabels[user.role]} workspace · Milestone 5</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={user.is_verified
              ? "border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800"
              : "border-amber-200 bg-amber-50 px-3 py-1 text-amber-800"}
          >
            <span className={`mr-1 size-1.5 rounded-full ${user.is_verified ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span className="hidden sm:inline">{user.is_verified ? "Account verified" : "Verification pending"}</span>
            <span className="sm:hidden">{user.is_verified ? "Verified" : "Pending"}</span>
          </Badge>
        </header>

        <main className="flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
          <div className="mx-auto max-w-7xl">
            <DashboardPanel user={user} view={activeView} onNavigate={setActiveView} onUserRefresh={loadUser} />
          </div>
        </main>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}

function DashboardPanel({ user, view, onNavigate, onUserRefresh }: { user: DappUser; view: DashboardView; onNavigate: (view: DashboardView) => void; onUserRefresh: () => Promise<void> }) {
  if (view === "farmer-profile" && user.role === "FARMER") return <FarmerProfilePanel onProfileSaved={() => void onUserRefresh()} />;
  if (view === "farmer-crops" && user.role === "FARMER") return <FarmerCropsPanel />;
  if (view === "centres") return <CentresPanel role={user.role} />;
  if (view === "crop-catalogue" && user.role === "ADMIN") return <CropCataloguePanel />;
  if (view === "procurement-requests") return <ProcurementRequestsPanel user={user} />;
  if (view === "appointments") return <AppointmentsPanel user={user} />;
  if (view === "procurement-desk" && user.role !== "FARMER") return <ProcurementDeskPanel />;
  if (view === "procurement-records") return <TransactionsPanel user={user} />;
  if (view === "payments") return <PaymentsPanel user={user} />;
  if (view === "notifications") return <NotificationsPanel />;
  if (view === "grievances") return <GrievancesPanel user={user} />;
  if (view === "analytics" && user.role !== "FARMER") return <AnalyticsPanel />;
  return <OverviewPanel user={user} onNavigate={onNavigate} />;
}
