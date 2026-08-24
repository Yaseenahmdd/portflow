import type { Purchase } from "@/lib/constants";

export function parseHoldingPurchases(raw: string | null): Purchase[] | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Purchase[]) : undefined;
  } catch {
    return undefined;
  }
}
