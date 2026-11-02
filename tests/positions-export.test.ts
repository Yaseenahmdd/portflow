import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import type { Holding } from "../src/lib/constants.ts";
import { buildPositionsWorkbook } from "../src/lib/positions-export.ts";
import { computeHolding } from "../src/lib/utils.ts";

function holding(overrides: Partial<Holding>): Holding {
  return {
    id: "h",
    platform: "IBKR",
    assetName: "Example",
    ticker: "EX",
    assetClass: "Stocks",
    sector: "",
    geography: "US",
    risk: "Medium",
    quantity: 1,
    avgBuyPrice: 1,
    currentPrice: 1,
    currency: "USD",
    notes: "",
    priceSource: "manual",
    ...overrides,
  };
}

test("positions workbook lists holdings by AED value with numeric cells and a summary", async () => {
  const inrToAedRate = 0.044;
  const holdings = [
    holding({ id: "a", assetName: "Small INR", currency: "INR", geography: "India", quantity: 10, avgBuyPrice: 100, currentPrice: 120 }),
    holding({ id: "b", assetName: "Big USD", quantity: 5, avgBuyPrice: 100, currentPrice: 90, previousClose: 100 }),
  ].map((h) => computeHolding(h, inrToAedRate));

  const built = await buildPositionsWorkbook(holdings, inrToAedRate);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await built.xlsx.writeBuffer());

  const positions = workbook.getWorksheet("Positions");
  assert.ok(positions);
  assert.equal(positions.rowCount, 3);
  const headers = positions.getRow(1).values as string[];
  const column = (name: string) => headers.indexOf(name);

  const first = positions.getRow(2);
  assert.equal(first.getCell(column("Asset")).value, "Big USD");
  assert.equal(first.getCell(column("Current value (AED)")).value, 5 * 90 * 3.6725);
  assert.equal(first.getCell(column("Gain/Loss %")).value, -0.1);
  assert.equal(first.getCell(column("Day change %")).value, -0.1);
  assert.equal(positions.getRow(3).getCell(column("Day change %")).value, null);

  const summary = workbook.getWorksheet("Summary");
  assert.ok(summary);
  const labels = new Map<string, unknown>();
  summary.eachRow((row) => labels.set(String(row.getCell(1).value), row.getCell(2).value));
  const totalInvested = holdings.reduce((sum, h) => sum + h.investedAmountAed, 0);
  assert.equal(labels.get("Holdings"), 2);
  assert.equal(labels.get("Invested"), totalInvested);
  assert.ok(labels.has("India"));
  assert.ok(labels.has("Stocks"));
});
