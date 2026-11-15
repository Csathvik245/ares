import { describe, expect, it } from "vitest";
import {
  NO_VALUE,
  formatDose,
  formatDuration,
  formatKm,
  formatLmst,
  formatMet,
  formatMinutes,
  formatPct,
  roundHalfUp,
  wholeMinutes,
} from "./format";

describe("roundHalfUp: the one rounding rule", () => {
  it("halfway values go up", () => {
    expect(roundHalfUp(38.5)).toBe(39);
    expect(roundHalfUp(38.49)).toBe(38);
    expect(roundHalfUp(0.5)).toBe(1);
    expect(roundHalfUp(-38.5)).toBe(-38); // "up" means toward the larger number
    expect(roundHalfUp(-38.51)).toBe(-39);
  });

  it("works with decimals, where toFixed alone gets halfway values wrong", () => {
    expect((1.005).toFixed(2)).toBe("1.00"); // the JavaScript surprise we are avoiding
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(2.345, 2)).toBe(2.35);
    expect(roundHalfUp(0.0925, 3)).toBe(0.093);
  });

  it("is not tipped the wrong way by floating-point noise", () => {
    expect(roundHalfUp(2309.9999999999995 / 60)).toBe(39); // meant to be exactly 38.5
    expect(roundHalfUp(0.1 + 0.2, 1)).toBe(0.3);
  });
});

describe("the HUD / panel mismatch: 39 min vs 38 min", () => {
  // The margin was 2,310 s = 38.5 min. The HUD rounded (39); the panel dropped the
  // decimals (38). Every formatter must now give 39.
  const marginSec = 2310;

  it("the old ways disagree", () => {
    expect(Math.round(marginSec / 60)).toBe(39);
    expect(Math.floor(marginSec / 60)).toBe(38);
    expect(Math.trunc(marginSec / 60)).toBe(38);
  });

  it("every formatter agrees on 39", () => {
    expect(wholeMinutes(marginSec)).toBe(39);
    expect(formatMinutes(marginSec)).toBe("39 min");
    expect(formatDuration(marginSec)).toBe("0:39");
    expect(formatMet(marginSec)).toBe("T+0:39");
  });

  it("minutes and h:mm agree for every second of an 8 hour EVA", () => {
    for (let sec = 0; sec <= 8 * 3600; sec++) {
      const min = wholeMinutes(sec);
      const [h, m] = formatDuration(sec).split(":").map(Number);
      expect(h * 60 + m).toBe(min);
      expect(formatMinutes(sec)).toBe(`${min} min`);
    }
  });
});

describe("formatMinutes", () => {
  it("rounds half up and labels the unit", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(29)).toBe("0 min");
    expect(formatMinutes(30)).toBe("1 min");
    expect(formatMinutes(11520)).toBe("192 min");
  });

  it("uses a real minus sign for negative values and never shows −0", () => {
    expect(formatMinutes(-720)).toBe("−12 min");
    expect(formatMinutes(-5400)).toBe("−90 min");
    expect(formatMinutes(-10)).toBe("0 min");
  });
});

describe("formatDuration (h:mm)", () => {
  it("rounds to the minute first, then splits", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(59)).toBe("0:01");
    expect(formatDuration(3599)).toBe("1:00"); // not "0:60"
    expect(formatDuration(3600)).toBe("1:00");
    expect(formatDuration(12900)).toBe("3:35");
    expect(formatDuration(8 * 3600)).toBe("8:00");
    expect(formatDuration(-720)).toBe("−0:12");
  });
});

describe("formatKm, formatPct, formatDose", () => {
  it("formatKm: meters to km with two decimals", () => {
    expect(formatKm(4970)).toBe("4.97 km");
    expect(formatKm(4974.9)).toBe("4.97 km");
    expect(formatKm(4975)).toBe("4.98 km");
    expect(formatKm(0)).toBe("0.00 km");
    expect(formatKm(12000)).toBe("12.00 km");
  });

  it("formatPct: whole percent", () => {
    expect(formatPct(48.5)).toBe("49%");
    expect(formatPct(48.49)).toBe("48%");
    expect(formatPct(100)).toBe("100%");
    expect(formatPct(0)).toBe("0%");
  });

  it("formatDose: mSv with three decimals", () => {
    expect(formatDose(0)).toBe("0.000 mSv");
    expect(formatDose(0.0925)).toBe("0.093 mSv");
    expect(formatDose(0.64)).toBe("0.640 mSv");
    expect(formatDose(1.23449)).toBe("1.234 mSv");
  });
});

describe("formatLmst and formatMet", () => {
  it("formatLmst: clock time, wrapping past midnight", () => {
    expect(formatLmst(13)).toBe("13:00");
    expect(formatLmst(6.69)).toBe("06:41");
    expect(formatLmst(23.9999)).toBe("00:00"); // rounds up to midnight, not "23:60" or "24:00"
    expect(formatLmst(24.5)).toBe("00:30");
    expect(formatLmst(-1)).toBe("23:00");
  });

  it("formatMet: mission elapsed time", () => {
    expect(formatMet(0)).toBe("T+0:00");
    expect(formatMet(4560)).toBe("T+1:16");
    expect(formatMet(12900)).toBe("T+3:35");
    expect(formatMet(-300)).toBe("T−0:05");
  });
});

describe("missing values", () => {
  it("every formatter shows a dash instead of NaN or Infinity", () => {
    for (const format of [formatMinutes, formatDuration, formatKm, formatPct, formatDose, formatLmst, formatMet]) {
      for (const bad of [NaN, Infinity, -Infinity, undefined, null]) {
        expect(format(bad)).toBe(NO_VALUE);
      }
    }
    expect(Number.isNaN(wholeMinutes(NaN))).toBe(true);
  });
});
