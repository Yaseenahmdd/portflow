import assert from "node:assert/strict";
import test from "node:test";
import { parseAmfiNavFeed, selectPreviousNav } from "../src/lib/api/mfapi.ts";

test("parseAmfiNavFeed reads the current eight-column AMFI format", () => {
  const feed = [
    "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
    "127042;INF247L01445;-;Motilal Oswal Midcap Fund;;;122.7784;28-Aug-2026",
    "147946;INF194KB1AL4;-;BANDHAN Small Cap Fund;Direct Plan;Growth;57.559;28-Aug-2026",
  ].join("\n");

  assert.deepEqual(parseAmfiNavFeed(feed, ["127042", "147946"]), [
    {
      schemeCode: "127042",
      schemeName: "Motilal Oswal Midcap Fund",
      nav: 122.7784,
      date: "28-Aug-2026",
    },
    {
      schemeCode: "147946",
      schemeName: "BANDHAN Small Cap Fund - Direct Plan - Growth",
      nav: 57.559,
      date: "28-Aug-2026",
    },
  ]);
});

test("parseAmfiNavFeed reads the legacy AMFI format and filters invalid rows", () => {
  const feed = [
    "\uFEFFScheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date",
    "127042;INF247L01445;-;Motilal Oswal Midcap Fund;121.45;27-Aug-2026",
    "147946;INF194KB1AL4;-;BANDHAN Small Cap Fund;not-a-number;27-Aug-2026",
    "999999;;;Unrequested Fund;10.00;27-Aug-2026",
  ].join("\r\n");

  assert.deepEqual(parseAmfiNavFeed(feed, ["147946", "127042"]), [
    {
      schemeCode: "127042",
      schemeName: "Motilal Oswal Midcap Fund",
      nav: 121.45,
      date: "27-Aug-2026",
    },
  ]);
});

test("selectPreviousNav uses the latest market day before the current NAV date", () => {
  assert.equal(
    selectPreviousNav(
      [
        { date: "20-09-2026", nav: "105.00" },
        { date: "18-09-2026", nav: "102.50" },
        { date: "17-09-2026", nav: "101.25" },
      ],
      "20-Sep-2026"
    ),
    102.5
  );
});
