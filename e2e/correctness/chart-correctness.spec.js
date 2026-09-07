import { test, expect } from "@playwright/test";

const start = 1788355800;
function history(symbol, timeframe) {
  const base = { AAPL: 100, TSLA: 200, SPY: 300, QQQ: 400, MSFT: 500 }[symbol] || 600;
  const seconds = { "1m": 60, "5m": 300, "15m": 900, "1H": 3600, "1D": 86400 }[timeframe];
  return { symbol, timeframe, source: "Recorded test provider", quality: "historical", session: "test-session",
    candles: Array.from({ length: 70 }, (_, index) => ({ time: start + index * seconds, open: base + index,
      high: base + index + 2, low: base + index - 1, close: base + index + 1, volume: index === 0 ? null : 1000 + index })) };
}

async function setup(page, transform = data => data, query = "") {
  const errors = [];
  const executions = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/\/orders\/(submit|execute)|\/positions\/close|\/trade\/(buy|sell)/i.test(request.url())) executions.push(request.url()); });
  await page.route("http://127.0.0.1:4999/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/candles/")) {
      const payload = history(decodeURIComponent(url.pathname.split("/").at(-1)), url.searchParams.get("timeframe"));
      const result = await transform(payload);
      if (result === "error") return route.fulfill({ status: 503, json: { error: "Test provider offline" } });
      return route.fulfill({ json: result });
    }
    await route.fulfill({ json: { quotes: [], data: [], success: true } });
  });
  await page.goto(`/e2e/correctness/${query}`);
  return { errors, executions };
}

const mainCanvas = page => page.locator('[data-chart-panel="main"] [data-chart-canvas]');
const ledger = page => page.getByTestId("ledger").evaluate(element => JSON.parse(element.textContent));

test("Charts sample breadth excludes synthetic and unknown rows and separates unchanged moves", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const evidence = await setup(page, payload => payload, "?chartsSample");
  const card = page.getByText("Workspace Sample Breadth", { exact: true }).locator("..");
  await expect(card).toContainText("1 advancing / 0 declining / 1 unchanged");
  await expect(card).toContainText("2 of 4 tracked symbols with usable moves");
  expect(evidence.errors).toEqual([]);
});

test("shared quotes expire locally when the provider goes silent without inventing new timestamps", async ({ page }) => {
  const evidence = await setup(page, payload => payload, "?quoteAging");
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "1");
  await page.getByRole("button", { name: "Inject aging quote" }).click();
  await expect(page.getByTestId("quote-quality")).toHaveText("live");
  const asOf = await page.getByTestId("quote-asof").innerText();
  await expect(page.getByTestId("quote-quality")).toHaveText("stale", { timeout: 5000 });
  await expect(page.getByTestId("quote-asof")).toHaveText(asOf);
  expect(evidence.errors).toEqual([]);
});

test("market pulse validates each historical series without overwriting quote provenance or counting synthetic breadth", async ({ page }) => {
  const evidence = await setup(page, payload => payload.symbol === "SPY" ? { ...payload, quality: "cached" }
    : payload.symbol === "QQQ" ? { ...payload, isSynthetic: true }
      : { ...payload, symbol: "WRONG" }, "?marketPulse");
  const pulse = page.getByRole("region", { name: "Market pulse", exact: true });
  await expect(pulse.getByRole("img", { name: "SPY cached price series", exact: true })).toBeVisible();
  await expect(pulse.getByRole("button", { name: "Select SPY", exact: true })).toContainText("Recorded quote provider");
  await expect(pulse.getByRole("img")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Workspace sample breadth" })).toContainText("Sample breadth (1 symbols)");
  expect(evidence.errors).toEqual([]);
});

test("compact replay reports unavailable metrics instead of a fictional open position or zero loss", async ({ page }) => {
  const evidence = await setup(page, () => "error", "?compactReplay");
  const panel = page.getByRole("complementary", { name: "Compact replay" });
  await expect(page.locator('header [role="status"]')).toHaveText("UNAVAILABLE");
  await expect(panel.getByText("OPEN", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("$100000.00", { exact: true })).toHaveCount(0);
  await expect(panel).toContainText("avg loss Unavailable");
  await expect(panel.getByRole("button", { name: "Paper Buy", exact: true })).toBeDisabled();
  expect(evidence.executions).toEqual([]);
  expect(evidence.errors).toEqual([]);
});

test("real replay chart starts at bar zero, steps, closes partially and rewinds without live execution", async ({ page }) => {
  const evidence = await setup(page);
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "1");
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-end", String(start));
  await page.getByRole("button", { name: "Simulate buy", exact: true }).click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-end", String(start + 60));
  await page.getByLabel("Shares", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Simulate sell", exact: true }).click();
  await expect.poll(async () => (await ledger(page)).positions[0]?.qty).toBe(60);
  expect((await ledger(page)).events[0].qty).toBe(100);
  expect((await ledger(page)).mark).toBe(102);
  await page.getByLabel("Replay notes").fill("Keep this note after rewind");
  await page.getByRole("button", { name: "Rewind", exact: true }).click();
  await expect.poll(async () => (await ledger(page)).archives).toBe(1);
  expect((await ledger(page)).positions).toEqual([]);
  await expect(page.getByLabel("Replay notes")).toHaveValue("Keep this note after rewind");
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "1");
  expect(evidence.executions).toEqual([]);
  expect(evidence.errors).toEqual([]);
});

test("replay indicators, fill markers and tooltips use only the visible time boundary", async ({ page }) => {
  const evidence = await setup(page);
  const chart = mainCanvas(page);
  await expect(chart).toHaveAttribute("data-visible-candle-count", "1");
  await page.getByRole("button", { name: "Simulate buy", exact: true }).click();
  await expect(chart).toHaveAttribute("data-marker-count", "1");
  await expect(chart).toHaveAttribute("data-marker-end", String(start));
  await page.getByLabel("Replay index").fill("25");
  await expect(chart).toHaveAttribute("data-visible-candle-count", "26");
  await expect(chart).toHaveAttribute("data-indicator-end", String(start + 25 * 60));
  await page.getByRole("button", { name: "Simulate sell", exact: true }).click();
  await expect(chart).toHaveAttribute("data-marker-end", String(start + 25 * 60));
  expect((await ledger(page)).positions).toEqual([]);
  const box = await chart.boundingBox();
  const tooltip = chart.locator("[data-chart-tooltip]");
  for (let x = 25; x < box.width - 90 && !(await tooltip.isVisible()); x += 15) {
    await page.mouse.move(box.x + x, box.y + box.height / 2);
  }
  await expect(tooltip).toBeVisible();
  const content = await tooltip.innerText();
  const close = Number(content.match(/C: (\d+\.\d+)/)?.[1]);
  expect(close).toBeGreaterThanOrEqual(101);
  expect(close).toBeLessThanOrEqual(126);
  await page.getByLabel("Replay index").fill("0");
  await expect(chart).toHaveAttribute("data-marker-count", "0");
  await expect(chart).toHaveAttribute("data-indicator-end", String(start));
  await expect(tooltip).toBeHidden();
  expect(evidence.errors).toEqual([]);
});

test("real chart tooltips retain known volume and distinguish zero from missing volume", async ({ page }) => {
  const evidence = await setup(page, payload => ({ ...payload,
    candles: payload.candles.map((row, index) => ({ ...row, volume: index === 0 ? null : index === 1 ? 0 : 123 })) }));
  const chart = mainCanvas(page);
  await expect(chart).toHaveAttribute("data-visible-candle-count", "1");
  const tooltip = chart.locator("[data-chart-tooltip]");
  for (const [index, expected] of [[0, "Unavailable"], [1, "0"], [2, "123"]]) {
    await page.getByLabel("Replay index").fill(String(index));
    await expect(chart).toHaveAttribute("data-visible-candle-count", String(index + 1));
    const box = await chart.boundingBox();
    let matched = false;
    for (let x = box.width - 85; x > 10; x -= 10) {
      await page.mouse.move(box.x + x, box.y + box.height / 2);
      if (await tooltip.isVisible() && (await tooltip.innerText()).includes(`C: ${(101 + index).toFixed(2)}`)) {
        matched = true;
        break;
      }
    }
    expect(matched).toBe(true);
    await expect(tooltip).toContainText(`Vol: ${expected}`);
  }
  expect(evidence.errors).toEqual([]);
});

test("playback pauses, reaches the end, and restores a saved ledger against its dataset", async ({ page }) => {
  const evidence = await setup(page);
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "1");
  await page.getByRole("button", { name: "Simulate buy", exact: true }).click();
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await page.getByLabel("Shares", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Simulate sell", exact: true }).click();
  await page.getByRole("button", { name: "Save replay", exact: true }).click();
  await page.getByRole("button", { name: "Reset replay", exact: true }).click();
  await page.getByRole("button", { name: "Restore replay", exact: true }).click();
  await expect.poll(async () => (await ledger(page)).positions[0]?.qty).toBe(60);
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-end", String(start + 60));
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await ledger(page)).index).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = (await ledger(page)).index;
  await page.waitForTimeout(1000);
  expect((await ledger(page)).index).toBe(paused);
  await page.getByLabel("Replay index").fill("68");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => (await ledger(page)).index).toBe(69);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-end", String(start + 69 * 60));
  expect(evidence.errors).toEqual([]);
});

for (const quality of ["cached", "delayed"]) {
  test(`${quality} candles retain their explicit quality in the chart`, async ({ page }) => {
    const evidence = await setup(page, payload => ({ ...payload, quality }));
    await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "1");
    await expect(page.locator('header [role="status"]')).toHaveText(quality.toUpperCase());
    expect(evidence.errors).toEqual([]);
  });
}

test("a late response for the previous symbol cannot replace the new chart", async ({ page }) => {
  let oldRequestStarted;
  const started = new Promise(resolve => { oldRequestStarted = resolve; });
  let releaseOld;
  const held = new Promise(resolve => { releaseOld = resolve; });
  const evidence = await setup(page, async payload => {
    if (payload.symbol === "AAPL") { oldRequestStarted(); await held; }
    return payload;
  });
  await started;
  const input = page.getByRole("textbox", { name: /ticker/i }).first();
  await input.fill("TSLA");
  await input.press("Enter");
  await expect(mainCanvas(page)).toHaveAttribute("data-chart-canvas", "TSLA");
  await expect.poll(async () => (await ledger(page)).mark).toBe(201);
  releaseOld();
  await page.waitForTimeout(200);
  expect((await ledger(page)).mark).toBe(201);
  expect(evidence.errors).toEqual([]);
});

test("quote transport reconnects without inventing candles or dropping provider identity", async ({ page }) => {
  const evidence = await setup(page);
  let attempts = 0;
  await page.route("http://127.0.0.1:4999/api/questrade/quotes?**", async route => {
    attempts++;
    if (attempts === 1) return route.fulfill({ status: 503, json: { error: "Temporary test outage" } });
    return route.fulfill({ json: { quotes: [{ symbol: "AAPL", price: 777, source: "Recorded quote provider", timestamp: Math.floor(Date.now() / 1000), volume: 0 }] } });
  });
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "1");
  await page.getByLabel("Replay", { exact: true }).uncheck();
  await expect(mainCanvas(page)).toHaveAttribute("data-quote-price", "777", { timeout: 20000 });
  expect(attempts).toBeGreaterThanOrEqual(2);
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "70");
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-end", String(start + 69 * 60));
  await page.getByLabel("Replay", { exact: true }).check();
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "1");
  expect((await ledger(page)).mark).toBe(101);
  expect(evidence.errors).toEqual([]);
});

test("out-of-order quote callbacks cannot replace the newest pending chart quote", async ({ page }) => {
  const evidence = await setup(page);
  await page.getByLabel("Replay", { exact: true }).uncheck();
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "70");
  await page.evaluate(async () => {
    const { marketDataService } = await import("/src/services/marketDataService.js");
    const timestamp = Math.floor(Date.now() / 1000);
    marketDataService.emitQuote({ symbol: "AAPL", price: 777, source: "Recorded provider", timestamp });
    marketDataService.emitQuote({ symbol: "AAPL", price: 666, source: "Recorded provider", timestamp: timestamp - 1 });
  });
  await expect(mainCanvas(page)).toHaveAttribute("data-quote-price", "777");
  await expect(mainCanvas(page)).toHaveAttribute("data-visible-end", String(start + 69 * 60));
  expect(evidence.errors).toEqual([]);
});

for (const failure of ["empty", "wrong-symbol", "synthetic", "malformed", "error"]) {
  test(`provider ${failure} is unavailable with an explicit successful retry`, async ({ page }) => {
    let recovering = false;
    const evidence = await setup(page, payload => {
      if (recovering) return payload;
      if (failure === "error") return "error";
      if (failure === "empty") return { ...payload, candles: [] };
      if (failure === "wrong-symbol") return { ...payload, symbol: "WRONG" };
      if (failure === "synthetic") return { ...payload, isSynthetic: true, quality: "simulated" };
      return { ...payload, candles: [{ ...payload.candles[0], low: 999 }] };
    });
    await expect(page.locator('header [role="status"]')).toHaveText("UNAVAILABLE");
    expect((await ledger(page)).mark).toBeNull();
    await page.getByRole("button", { name: "Simulate buy", exact: true }).click();
    expect((await ledger(page)).events).toEqual([]);
    recovering = true;
    await page.getByRole("button", { name: /retry/i }).click();
    await expect(mainCanvas(page)).toHaveAttribute("data-visible-candle-count", "1");
    expect(evidence.errors).toEqual([]);
    expect(evidence.executions).toEqual([]);
  });
}

test("four charts retain separate symbols and intervals, sync explicitly, capture their own panel and persist", async ({ page }) => {
  const evidence = await setup(page);
  await page.getByLabel("Replay", { exact: true }).uncheck();
  await page.getByLabel("Chart count").selectOption("4");
  const third = page.locator('[data-chart-panel="third"]');
  await third.getByLabel("Chart 3 ticker").fill("MSFT");
  await third.getByLabel("Chart 3 ticker").press("Enter");
  await third.getByLabel("Chart 3 interval").selectOption("1D");
  const fourth = page.locator('[data-chart-panel="fourth"]');
  await fourth.getByLabel("Chart 4 ticker").fill("SPY");
  await fourth.getByLabel("Chart 4 ticker").press("Enter");
  await fourth.getByLabel("Chart 4 interval").selectOption("15m");
  const expected = [["main", "AAPL", "1m"], ["secondary", "TSLA", "5m"], ["third", "MSFT", "1D"], ["fourth", "SPY", "15m"]];
  for (const [id, symbol, interval] of expected) {
    const panel = page.locator(`[data-chart-panel="${id}"]`);
    await expect(panel.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-symbol", symbol);
    await expect(panel.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-interval", interval);
    await expect(panel.locator("[data-chart-canvas]")).toHaveAttribute("data-visible-candle-count", "70");
  }
  const download = page.waitForEvent("download");
  await third.getByRole("button", { name: "Chart 3 screenshot" }).click();
  expect((await download).suggestedFilename()).toBe("MSFT-1D.png");
  await third.getByRole("button", { name: "Chart 3 fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.dataset.chartSymbol)).toBe("MSFT");
  await page.evaluate(() => document.exitFullscreen());
  await page.getByLabel("Sync", { exact: true }).check();
  await expect(third.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-symbol", "AAPL");
  await expect(third.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-interval", "1m");
  await page.getByLabel("Sync", { exact: true }).uncheck();
  await expect(third.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-symbol", "MSFT");
  await page.reload();
  await page.getByLabel("Chart count").selectOption("4");
  await expect(third.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-symbol", "MSFT");
  await expect(third.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-interval", "1D");
  await expect(fourth.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-symbol", "SPY");
  await expect(fourth.locator("[data-chart-symbol]")).toHaveAttribute("data-chart-interval", "15m");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("sb_additional_charts")))).toEqual({
    third: { symbol: "MSFT", interval: "1D" }, fourth: { symbol: "SPY", interval: "15m" },
  });
  expect(evidence.errors).toEqual([]);
});

for (const [width, height] of [[1920,1080], [1600,900], [1366,768], [390,844]]) {
  for (const theme of ["dark", "light"]) {
    test(`actual chart canvases ${theme} ${width}x${height}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      const evidence = await setup(page);
      await page.getByLabel("Replay", { exact: true }).uncheck();
      await page.getByLabel("Chart count").selectOption("4");
      if (theme === "light") await page.getByRole("button", { name: "Theme", exact: true }).click();
      for (const [index, id] of ["main", "secondary", "third", "fourth"].entries()) {
        if (width < 761) await page.getByRole("button", { name: `Chart ${index + 1}`, exact: true }).click();
        const plot = page.locator(`[data-chart-panel="${id}"] [data-chart-canvas]`);
        await expect(plot).toHaveAttribute("data-visible-candle-count", "70");
        const box = await plot.boundingBox();
        expect(box.width).toBeGreaterThan(250);
        expect(box.height).toBeGreaterThan(140);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
        await expect.poll(() => plot.locator("canvas").first().evaluate(canvas => {
          const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          let colored = 0;
          for (let p = 0; p < data.length; p += 4) if (data[p + 3] && (data[p + 1] > data[p] * 1.4 || data[p] > data[p + 1] * 1.4)) colored++;
          return colored;
        })).toBeGreaterThan(50);
        const tooltip = plot.locator("[data-chart-tooltip]");
        for (let x = 25; x < box.width - 80 && !(await tooltip.isVisible()); x += 15) {
          await page.mouse.move(box.x + x, box.y + box.height / 2);
        }
        await expect(tooltip).toBeVisible();
        await expect(tooltip).toContainText(["AAPL", "TSLA", "SPY", "QQQ"][index]);
      }
      await page.screenshot({ path: testInfo.outputPath(`charts-${theme}-${width}.png`), fullPage: true });
      expect(evidence.errors).toEqual([]);
    });
  }
}
