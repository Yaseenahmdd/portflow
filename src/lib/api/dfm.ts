import https from "https";

export interface DfmQuote {
  id: string;
  lastradeprice: number;
  previousclosingprice: number;
  changepercentage: number;
  lastradetime: string | null;
}

export async function fetchDfmQuotes(symbols: string[]): Promise<Record<string, DfmQuote>> {
  try {
    const data = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const req = https.request(
        "https://api2.dfm.ae/mw/v1/stocks",
        {
          method: "GET",
          rejectUnauthorized: false,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`DFM error: ${res.statusCode}`));
            return;
          }
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        }
      );
      req.on("error", reject);
      req.end();
    });
    const wanted = new Set(symbols);
    const results: Record<string, DfmQuote> = {};

    for (const row of data) {
      const id = String(row.id || "");
      if (!wanted.has(id)) continue;

      results[id] = {
        id,
        lastradeprice: Number(row.lastradeprice || 0),
        previousclosingprice: Number(row.previousclosingprice || 0),
        changepercentage: Number(row.changepercentage || 0),
        lastradetime: typeof row.lastraded === "string" ? row.lastraded : null,
      };
    }

    return results;
  } catch (error) {
    console.error("DFM: failed to fetch delayed quotes:", error);
    return {};
  }
}
