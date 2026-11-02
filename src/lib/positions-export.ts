import { USD_TO_AED, type ComputedHolding } from "@/lib/constants";
import type { Column, Worksheet } from "exceljs";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const MONEY_FORMAT = "#,##0.00;[Red]-#,##0.00";
const PRICE_FORMAT = "#,##0.00####";
const PERCENT_FORMAT = "0.00%;[Red]-0.00%";
const DATE_FORMAT = "yyyy-mm-dd hh:mm";

type PositionColumn = Partial<Column> & {
  header: string;
  key: string;
  value: (holding: ComputedHolding, totalValueAed: number) => string | number | Date | null;
};

// Excel stores dates without a zone, so shift to local time to match what the dashboard shows
function toLocalExcelDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
}

const POSITION_COLUMNS: PositionColumn[] = [
  { header: "Asset", key: "assetName", width: 34, value: (h) => h.assetName },
  { header: "Ticker", key: "ticker", width: 14, value: (h) => h.ticker },
  { header: "Platform", key: "platform", width: 12, value: (h) => h.platform },
  { header: "Asset class", key: "assetClass", width: 14, value: (h) => h.assetClass },
  { header: "Sector", key: "sector", width: 18, value: (h) => h.sector || null },
  { header: "Geography", key: "geography", width: 11, value: (h) => h.geography },
  { header: "Risk", key: "risk", width: 9, value: (h) => h.risk },
  { header: "Currency", key: "currency", width: 10, value: (h) => h.currency },
  { header: "Quantity", key: "quantity", width: 12, style: { numFmt: "General" }, value: (h) => h.quantity },
  { header: "Avg buy price", key: "avgBuyPrice", width: 14, style: { numFmt: PRICE_FORMAT }, value: (h) => h.avgBuyPrice },
  { header: "Current price", key: "currentPrice", width: 14, style: { numFmt: PRICE_FORMAT }, value: (h) => h.currentPrice },
  { header: "Invested", key: "investedAmount", width: 15, style: { numFmt: MONEY_FORMAT }, value: (h) => h.investedAmount },
  { header: "Current value", key: "currentValue", width: 15, style: { numFmt: MONEY_FORMAT }, value: (h) => h.currentValue },
  { header: "Gain/Loss", key: "gainLoss", width: 15, style: { numFmt: MONEY_FORMAT }, value: (h) => h.gainLoss },
  { header: "Gain/Loss %", key: "localGainLossPct", width: 12, style: { numFmt: PERCENT_FORMAT }, value: (h) => h.localGainLossPct / 100 },
  { header: "FX rate to AED", key: "rateToAed", width: 13, style: { numFmt: "0.0000####" }, value: (h) => h.rateToAed },
  { header: "Invested (AED)", key: "investedAmountAed", width: 16, style: { numFmt: MONEY_FORMAT }, value: (h) => h.investedAmountAed },
  { header: "Current value (AED)", key: "currentValueAed", width: 18, style: { numFmt: MONEY_FORMAT }, value: (h) => h.currentValueAed },
  { header: "Gain/Loss (AED)", key: "gainLossAed", width: 16, style: { numFmt: MONEY_FORMAT }, value: (h) => h.gainLossAed },
  { header: "Gain/Loss % (AED)", key: "gainLossPct", width: 16, style: { numFmt: PERCENT_FORMAT }, value: (h) => h.gainLossPct / 100 },
  { header: "Day change %", key: "dayGainPct", width: 13, style: { numFmt: PERCENT_FORMAT }, value: (h) => (h.dayGainPct === null ? null : h.dayGainPct / 100) },
  { header: "Day gain (AED)", key: "dayGainAed", width: 15, style: { numFmt: MONEY_FORMAT }, value: (h) => (h.hasDayGain ? h.dayGainAed : null) },
  { header: "Weight", key: "weight", width: 9, style: { numFmt: "0.00%" }, value: (h, total) => (total ? h.currentValueAed / total : 0) },
  { header: "Price source", key: "priceSource", width: 13, value: (h) => h.priceSource },
  { header: "Price as of", key: "priceAsOf", width: 17, style: { numFmt: DATE_FORMAT }, value: (h) => toLocalExcelDate(h.priceAsOf || h.lastPriceUpdate) },
  { header: "Notes", key: "notes", width: 30, value: (h) => h.notes || null },
];

function styleHeaderRow(sheet: Worksheet, rowNumber = 1) {
  const row = sheet.getRow(rowNumber);
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7EAF0" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF9AA3B2" } } };
  });
}

function groupByValue(holdings: ComputedHolding[], key: "assetClass" | "geography") {
  const grouped = new Map<string, { invested: number; value: number }>();
  for (const holding of holdings) {
    const label = holding[key] || "Uncategorized";
    const entry = grouped.get(label) ?? { invested: 0, value: 0 };
    entry.invested += holding.investedAmountAed;
    entry.value += holding.currentValueAed;
    grouped.set(label, entry);
  }
  return [...grouped.entries()].sort((a, b) => b[1].value - a[1].value);
}

function addBreakdown(
  sheet: Worksheet,
  title: string,
  rows: [string, { invested: number; value: number }][],
  totalValueAed: number
) {
  sheet.addRow([]);
  const headerRow = sheet.addRow([title, "Invested (AED)", "Value (AED)", "Gain/Loss (AED)", "Weight"]);
  styleHeaderRow(sheet, headerRow.number);
  for (const [label, { invested, value }] of rows) {
    const row = sheet.addRow([label, invested, value, value - invested, totalValueAed ? value / totalValueAed : 0]);
    row.getCell(2).numFmt = MONEY_FORMAT;
    row.getCell(3).numFmt = MONEY_FORMAT;
    row.getCell(4).numFmt = MONEY_FORMAT;
    row.getCell(5).numFmt = "0.00%";
  }
}

export async function buildPositionsWorkbook(holdings: ComputedHolding[], inrToAedRate: number) {
  const ExcelJS = await import("exceljs");
  const Workbook = ExcelJS.Workbook ?? ExcelJS.default.Workbook;
  const workbook = new Workbook();
  workbook.creator = "Portflow";
  workbook.created = new Date();

  const sorted = [...holdings].sort((a, b) => b.currentValueAed - a.currentValueAed);
  const totalInvested = sorted.reduce((sum, h) => sum + h.investedAmountAed, 0);
  const totalValue = sorted.reduce((sum, h) => sum + h.currentValueAed, 0);
  const totalGainLoss = sorted.reduce((sum, h) => sum + h.gainLossAed, 0);
  const dayGain = sorted.reduce((sum, h) => sum + (h.hasDayGain ? h.dayGainAed : 0), 0);

  const positions = workbook.addWorksheet("Positions", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  positions.columns = POSITION_COLUMNS.map(({ header, key, width, style }) => ({ header, key, width, style }));
  for (const holding of sorted) {
    positions.addRow(
      Object.fromEntries(POSITION_COLUMNS.map((column) => [column.key, column.value(holding, totalValue)]))
    );
  }
  styleHeaderRow(positions);
  positions.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sorted.length + 1), column: POSITION_COLUMNS.length },
  };

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 10 }];
  summary.addRow(["Portflow positions"]).font = { bold: true, size: 14 };
  summary.addRow(["Exported", toLocalExcelDate(new Date().toISOString())]).getCell(2).numFmt = DATE_FORMAT;
  summary.addRow(["Holdings", sorted.length]);
  summary.addRow(["USD → AED", USD_TO_AED]).getCell(2).numFmt = "0.0000";
  summary.addRow(["INR → AED", inrToAedRate]).getCell(2).numFmt = "0.000000";
  summary.addRow([]);

  const totalsHeader = summary.addRow(["Totals", "AED"]);
  styleHeaderRow(summary, totalsHeader.number);
  const totals: [string, number, string][] = [
    ["Invested", totalInvested, MONEY_FORMAT],
    ["Current value", totalValue, MONEY_FORMAT],
    ["Gain/Loss", totalGainLoss, MONEY_FORMAT],
    ["Gain/Loss %", totalInvested ? totalGainLoss / totalInvested : 0, PERCENT_FORMAT],
    ["Day gain", dayGain, MONEY_FORMAT],
  ];
  for (const [label, value, numFmt] of totals) {
    summary.addRow([label, value]).getCell(2).numFmt = numFmt;
  }

  addBreakdown(summary, "Asset class", groupByValue(sorted, "assetClass"), totalValue);
  addBreakdown(summary, "Geography", groupByValue(sorted, "geography"), totalValue);

  return workbook;
}

export async function downloadPositionsWorkbook(holdings: ComputedHolding[], inrToAedRate: number) {
  const workbook = await buildPositionsWorkbook(holdings, inrToAedRate);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `portflow-positions-${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.click();
  // Some mobile browsers start the download asynchronously, so keep the URL alive briefly
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
