import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatBps,
  formatMoney,
  presetRange,
  summarizeSeries,
  toNumber
} from "../affiliate/stats";

describe("presetRange", () => {
  it("covers the last N days including today, as ISO dates", () => {
    const today = new Date(2026, 10, 14, 18, 30);
    assert.deepEqual(presetRange(7, today), {
      from: "2026-11-08",
      to: "2026-11-14"
    });
    assert.deepEqual(presetRange(30, today), {
      from: "2026-10-16",
      to: "2026-11-14"
    });
  });
});

describe("summarizeSeries", () => {
  it("sums clicks, orders and commission and derives conversion", () => {
    const out = summarizeSeries([
      { date: "2026-11-13", clicks: 120, orders: 3, commission: "12.50" },
      { date: "2026-11-14", clicks: 80, orders: 1, commission: 4 }
    ]);
    assert.deepEqual(out, {
      clicks: 200,
      orders: 4,
      commission: 16.5,
      conversion: 0.02
    });
  });

  it("reports zero conversion with no clicks", () => {
    assert.equal(summarizeSeries([]).conversion, 0);
    assert.equal(
      summarizeSeries([
        { date: "2026-11-14", clicks: 0, orders: 1, commission: 0 }
      ]).conversion,
      0
    );
  });
});

describe("toNumber", () => {
  it("reads decimal strings and treats junk as zero", () => {
    assert.equal(toNumber("12.50"), 12.5);
    assert.equal(toNumber(3), 3);
    assert.equal(toNumber(null), 0);
    assert.equal(toNumber("abc"), 0);
  });
});

describe("formatting", () => {
  it("formats money in the given currency", () => {
    assert.equal(formatMoney("1234.5", "USD"), "$1,234.50");
    assert.equal(formatMoney(0), "$0.00");
  });

  it("formats basis points as a percentage", () => {
    assert.equal(formatBps(1000), "10%");
    assert.equal(formatBps(1250), "12.5%");
  });
});
