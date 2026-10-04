import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("formats persisted procurement quantities for Indian readers", async () => {
  const { formatCurrency, formatKilograms, formatNumber } = await vite.ssrLoadModule(
    "/lib/format.ts",
  );

  assert.equal(formatNumber("125000.50"), "1,25,000.5");
  assert.equal(formatKilograms("125000.50"), "1,25,000.5 kg");
  assert.match(formatCurrency("11280.00"), /11,280/);
});

test("milestone 4 physical procurement panels wait for scoped API data", async () => {
  const { ProcurementDeskPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/procurement-desk-panel.tsx",
  );
  const { TransactionsPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/transactions-panel.tsx",
  );
  const farmer = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "farmer@example.com",
    first_name: "Test",
    last_name: "Farmer",
    phone_number: null,
    preferred_language: "en",
    role: "FARMER",
    is_verified: true,
    profile_completed: true,
  };

  const desk = renderToStaticMarkup(React.createElement(ProcurementDeskPanel));
  const transactions = renderToStaticMarkup(
    React.createElement(TransactionsPanel, { user: farmer }),
  );

  assert.match(desk, /aria-label="Loading content"/);
  assert.match(transactions, /aria-label="Loading content"/);
  assert.doesNotMatch(desk, /No arrivals need processing/);
  assert.doesNotMatch(transactions, /No completed procurement transactions/);
});

test("connected dashboard panels render a safe loading state", async () => {
  const { FarmerCropsPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/farmer-crops-panel.tsx",
  );
  const html = renderToStaticMarkup(React.createElement(FarmerCropsPanel));

  assert.match(html, /aria-label="Loading content"/);
  assert.doesNotMatch(html, /No crop records yet/);
});

test("milestone 3 scheduling panels wait for scoped API data", async () => {
  const { ProcurementRequestsPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/procurement-requests-panel.tsx",
  );
  const { AppointmentsPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/appointments-panel.tsx",
  );
  const farmer = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "farmer@example.com",
    first_name: "Test",
    last_name: "Farmer",
    phone_number: null,
    preferred_language: "en",
    role: "FARMER",
    is_verified: true,
    profile_completed: true,
  };

  const requests = renderToStaticMarkup(
    React.createElement(ProcurementRequestsPanel, { user: farmer }),
  );
  const appointments = renderToStaticMarkup(
    React.createElement(AppointmentsPanel, { user: farmer }),
  );

  assert.match(requests, /aria-label="Loading content"/);
  assert.match(appointments, /aria-label="Loading content"/);
  assert.doesNotMatch(requests, /No procurement requests yet/);
  assert.doesNotMatch(appointments, /No arrival slots yet/);
});

test("milestone 5 operational panels wait for scoped API data", async () => {
  const { PaymentsPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/payments-panel.tsx",
  );
  const { NotificationsPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/notifications-panel.tsx",
  );
  const { GrievancesPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/grievances-panel.tsx",
  );
  const { AnalyticsPanel } = await vite.ssrLoadModule(
    "/app/dashboard/panels/analytics-panel.tsx",
  );
  const farmer = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "farmer@example.com",
    first_name: "Test",
    last_name: "Farmer",
    phone_number: null,
    preferred_language: "en",
    role: "FARMER",
    is_verified: true,
    profile_completed: true,
  };

  const panels = [
    renderToStaticMarkup(React.createElement(PaymentsPanel, { user: farmer })),
    renderToStaticMarkup(React.createElement(NotificationsPanel)),
    renderToStaticMarkup(React.createElement(GrievancesPanel, { user: farmer })),
    renderToStaticMarkup(React.createElement(AnalyticsPanel)),
  ];
  for (const html of panels) {
    assert.match(html, /aria-label="Loading content"/);
  }
  assert.doesNotMatch(panels[0], /No payments in this ledger yet/);
  assert.doesNotMatch(panels[1], /Your inbox is clear/);
  assert.doesNotMatch(panels[2], /No grievances lodged/);
});
