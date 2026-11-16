import { test, expect } from "@playwright/test";
import { setupApp, initialWorkspace } from "../support/appHarness.js";

test("terminal news opens reported purchases and filters by ticker with SEC evidence links", async ({ page }) => {
  await setupApp(page, { ...initialWorkspace, activeWorkspace: "news" });
  const href = "https://www.sec.gov/Archives/edgar/data/896493/000121465926011871/0001214659-26-011871-index.htm";
  await page.route("**/api/edgar/insider-purchases?*", route => {
    const ticker = new URL(route.request().url()).searchParams.get("ticker");
    const rows = ticker && ticker !== "EX" ? [] : [{
      id: "accession:purchase:0", issuer: "Example Inc.", ticker: "EX",
      owners: [{ name: "Reporting Owner" }], transactionDate: "2026-11-11",
      filingDate: "2026-11-12", shares: 50, price: 2, estimatedValue: 100,
      purchaseType: "Reported purchase", form: "4", sourceUrl: href,
    }];
    return route.fulfill({ json: {
      status: "cached", refreshing: false, refreshedAt: "2026-11-13T00:00:00Z",
      coverage: { verified: 1, eligible: 2, lookbackDays: 30 }, total: rows.length, rows,
    } });
  });

  await page.getByRole("button", { name: "Show filings" }).click();
  await expect(page.getByText("Reported insider purchases", { exact: true })).toBeVisible();
  await expect(page.getByText("Showing cached SEC filings.", { exact: false })).toBeVisible();
  await expect(page.getByText("Reporting Owner", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Form 4", exact: true })).toHaveAttribute("href", href);
  await page.getByLabel("Ticker", { exact: true }).fill("NVDA");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.getByText(/No reported purchases match/)).toBeVisible();
});

test("ownership view shows disclosed figures and switches back to purchases", async ({ page }) => {
  await setupApp(page, { ...initialWorkspace, activeWorkspace: "news" });
  await page.route("**/api/edgar/insider-purchases?*", route =>
    route.fulfill({ json: { status: "ready", total: 0, rows: [] } }));
  await page.route("**/api/edgar/ownership?*", route => route.fulfill({ json: {
    status: "ready", total: 1, rows: [{
      id: "ownership:0", issuer: "Funko, Inc.", ticker: "FNKO",
      reportingPerson: "Fund 1 Investments, LLC", form: "SCHEDULE 13D/A",
      filingDate: "2026-11-12", shares: 5303488, ownershipPercent: 9.4,
      amendmentNumber: 6, previousAccession: "0000921895-26-000513",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/1704711/000092189526003046/primary_doc.xml",
    }],
  } }));
  await page.getByRole("button", { name: "Show filings" }).click();
  await page.getByRole("tab", { name: "Ownership filings" }).click();
  await expect(page.getByText("Fund 1 Investments, LLC", { exact: true })).toBeVisible();
  await expect(page.getByText("9.4%", { exact: true })).toBeVisible();
  await expect(page.getByText("Amendment 6", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Schedule 13D/A", exact: true })).toHaveAttribute("href", /sec\.gov/);
  await page.getByRole("tab", { name: "Reported insider purchases" }).click();
  await expect(page.getByText(/No reported purchases match/)).toBeVisible();
});

test("institutional holdings show quarterly units and can filter by CUSIP", async ({ page }) => {
  await setupApp(page, { ...initialWorkspace, activeWorkspace: "news" });
  await page.route("**/api/edgar/insider-purchases?*", route =>
    route.fulfill({ json: { status: "ready", total: 0, rows: [] } }));
  await page.route("**/api/edgar/holdings?*", route => {
    const params = new URL(route.request().url()).searchParams;
    const rows = params.get("cusip") === "999999999" ? [] : [{
      id: "13f:holding:0", issuer: "APPLE INC", ticker: "AAPL", cusip: "037833100",
      manager: "Example manager", reportingPeriod: "2026-03-31",
      filingDate: "2026-05-08", shares: 8303, reportedValueUsd: 2107143,
      form: "13F-HR/A", amendmentType: "Adds holdings",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/1308778/000130877826000003/informationtable31032026.xml",
    }];
    return route.fulfill({ json: { status: "ready", total: rows.length, rows } });
  });
  await page.getByRole("button", { name: "Show filings" }).click();
  await page.getByRole("tab", { name: "Institutional holdings" }).click();
  await expect(page.getByText("2026-03-31", { exact: true })).toBeVisible();
  await expect(page.getByText("$2,107,143", { exact: true })).toBeVisible();
  await expect(page.getByText("Adds holdings", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "13F-HR/A" })).toHaveAttribute("href", /sec\.gov/);
  await page.getByLabel("CUSIP", { exact: true }).fill("999999999");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.getByText(/No institutional holdings match/)).toBeVisible();
});
