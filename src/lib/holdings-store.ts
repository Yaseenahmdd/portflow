import type { Holding } from "@/lib/constants";

interface HoldingRow {
  id: string;
  user_id: string;
  platform: string;
  asset_name: string;
  ticker: string;
  asset_class: string;
  sector: string;
  geography: string;
  risk: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  currency: string;
  notes: string;
  price_source: string;
  scheme_code: string | null;
  last_price_update: string | null;
  purchases: string | null;
}

type DeleteBuilder = Promise<{ error: { message: string } | null }> & {
  eq: (column: string, value: string) => DeleteBuilder;
};

type SupabaseLikeClient = {
  from?: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: HoldingRow[] | null; error: { message: string } | null }>;
      };
    };
    delete: () => DeleteBuilder;
    insert: (values: HoldingRow[]) => Promise<{ error: { message: string } | null }>;
    upsert: (
      values: HoldingRow[],
      options?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function hasDatabaseClient(client: unknown): client is Required<SupabaseLikeClient> {
  return typeof client === "object" && client !== null && typeof (client as SupabaseLikeClient).from === "function";
}

function mapRowToHolding(row: HoldingRow): Holding {
  return {
    id: row.id,
    platform: row.platform,
    assetName: row.asset_name,
    ticker: row.ticker,
    assetClass: row.asset_class as Holding["assetClass"],
    sector: row.sector,
    geography: row.geography as Holding["geography"],
    risk: row.risk as Holding["risk"],
    quantity: row.quantity,
    avgBuyPrice: row.avg_buy_price,
    currentPrice: row.current_price,
    currency: row.currency as Holding["currency"],
    notes: row.notes,
    priceSource: row.price_source as Holding["priceSource"],
    schemeCode: row.scheme_code || undefined,
    lastPriceUpdate: row.last_price_update || undefined,
    purchases: row.purchases ? JSON.parse(row.purchases) : undefined,
  };
}

function mapHoldingToRow(userId: string, holding: Holding): HoldingRow {
  return {
    user_id: userId,
    id: holding.id,
    platform: holding.platform,
    asset_name: holding.assetName,
    ticker: holding.ticker,
    asset_class: holding.assetClass,
    sector: holding.sector,
    geography: holding.geography,
    risk: holding.risk,
    quantity: holding.quantity,
    avg_buy_price: holding.avgBuyPrice,
    current_price: holding.currentPrice,
    currency: holding.currency,
    notes: holding.notes,
    price_source: holding.priceSource,
    scheme_code: holding.schemeCode || null,
    last_price_update: holding.lastPriceUpdate || null,
    purchases: holding.purchases ? JSON.stringify(holding.purchases) : null,
  };
}

function generateHoldingId() {
  return crypto.randomUUID();
}

function sanitizeHoldingIds(holdings: Holding[]): Holding[] {
  const seenIds = new Set<string>();

  return holdings.map((holding) => {
    const originalId = holding.id?.trim();
    const nextId =
      originalId && !seenIds.has(originalId)
        ? originalId
        : generateHoldingId();

    seenIds.add(nextId);

    if (nextId === holding.id) {
      return holding;
    }

    return {
      ...holding,
      id: nextId,
    };
  });
}

export async function fetchRemoteHoldings(client: unknown, userId: string): Promise<Holding[] | null> {
  if (!hasDatabaseClient(client)) {
    return null;
  }

  const { data, error } = await client
    .from("holdings")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapRowToHolding);
}

export async function replaceRemoteHoldings(client: unknown, userId: string, holdings: Holding[]): Promise<boolean> {
  if (!hasDatabaseClient(client)) {
    return false;
  }

  const sanitizedHoldings = sanitizeHoldingIds(holdings);

  const deleteResult = await client.from("holdings").delete().eq("user_id", userId);
  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  if (!sanitizedHoldings.length) {
    return true;
  }

  const rows = sanitizedHoldings.map((holding) => mapHoldingToRow(userId, holding));
  const upsertResult = await client.from("holdings").upsert(rows, {
    onConflict: "user_id,id",
  });
  if (upsertResult.error) {
    throw new Error(upsertResult.error.message);
  }

  return true;
}

export async function upsertRemoteHoldings(client: unknown, userId: string, holdings: Holding[]): Promise<boolean> {
  if (!hasDatabaseClient(client)) {
    return false;
  }

  const sanitizedHoldings = sanitizeHoldingIds(holdings);
  if (!sanitizedHoldings.length) {
    return true;
  }

  const rows = sanitizedHoldings.map((holding) => mapHoldingToRow(userId, holding));
  const upsertResult = await client.from("holdings").upsert(rows, {
    onConflict: "user_id,id",
  });
  
  if (upsertResult.error) {
    throw new Error(upsertResult.error.message);
  }

  return true;
}

export async function deleteRemoteHolding(client: unknown, userId: string, holdingId: string): Promise<boolean> {
  if (!hasDatabaseClient(client)) {
    return false;
  }

  const deleteResult = await client.from("holdings").delete().eq("user_id", userId).eq("id", holdingId);
  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  return true;
}
