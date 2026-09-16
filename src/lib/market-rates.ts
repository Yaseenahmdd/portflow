interface MarketRateRow {
  rate: number;
  fetched_at: string;
}

type MarketRateQuery = {
  maybeSingle: () => Promise<{
    data: MarketRateRow | null;
    error: { message: string } | null;
  }>;
};

type MarketRateClient = {
  from?: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => MarketRateQuery;
    };
  };
};

function hasMarketRateClient(client: unknown): client is Required<MarketRateClient> {
  return (
    typeof client === "object" &&
    client !== null &&
    typeof (client as MarketRateClient).from === "function"
  );
}

export async function fetchRemoteInrToAedRate(client: unknown) {
  if (!hasMarketRateClient(client)) {
    return null;
  }

  const { data, error } = await client
    .from("market_rates")
    .select("rate,fetched_at")
    .eq("pair", "INR_AED")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !Number.isFinite(data.rate) || data.rate <= 0) {
    return null;
  }

  return {
    rate: data.rate,
    fetchedAt: data.fetched_at,
  };
}
