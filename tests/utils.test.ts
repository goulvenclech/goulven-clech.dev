import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { formatDate, isEntryPublished, getMyAge, getRemoteWorkYears } from "../src/utils"

describe("formatDate", () => {
  it("formats a date as DD Month YYYY", () => {
    const date = new Date("2025-01-18")
    const result = formatDate(date)
    expect(result).toBe("18 January 2025")
  })

  it("handles different months correctly", () => {
    const date = new Date("2024-07-04")
    const result = formatDate(date)
    expect(result).toBe("4 July 2024")
  })
})

describe("isEntryPublished", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("filters out 'never' entries in all modes", () => {
    expect(isEntryPublished("never")).toBe(false)
    expect(isEntryPublished("never", true)).toBe(false)
  })

  it("filters out 'draft' entries in strict mode", () => {
    expect(isEntryPublished("draft", true)).toBe(false)
  })
})

describe("getMyAge", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("calculates age correctly before birthday", () => {
    vi.setSystemTime(new Date("2025-01-18")) // Before November 15
    expect(getMyAge()).toBe(27)
  })

  it("calculates age correctly after birthday", () => {
    vi.setSystemTime(new Date("2025-12-01")) // After November 15
    expect(getMyAge()).toBe(28)
  })
})

describe("getRemoteWorkYears", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("calculates years correctly before March anniversary", () => {
    vi.setSystemTime(new Date("2025-01-18")) // Before March
    expect(getRemoteWorkYears()).toBe(6)
  })

  it("calculates years correctly after March anniversary", () => {
    vi.setSystemTime(new Date("2025-04-01")) // After March
    expect(getRemoteWorkYears()).toBe(7)
  })
})
