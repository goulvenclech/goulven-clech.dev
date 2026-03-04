import { describe, it, expect } from "vitest"
import { parseAmazonImageSize } from "../../src/components/blocks/amazonUtils"

describe("parseAmazonImageSize", () => {
	it("extracts dimensions from a URL with _SL1500_", () => {
		const url = "https://m.media-amazon.com/images/I/81example._AC_SL1500_.jpg"
		expect(parseAmazonImageSize(url)).toEqual({ width: 1500, height: 1500 })
	})

	it("extracts dimensions from a URL with _SL500_", () => {
		const url = "https://m.media-amazon.com/images/I/71abc._AC_SL500_.jpg"
		expect(parseAmazonImageSize(url)).toEqual({ width: 500, height: 500 })
	})

	it("returns undefined when URL has no SL pattern", () => {
		const url = "https://m.media-amazon.com/images/I/71abc._AC_.jpg"
		expect(parseAmazonImageSize(url)).toBeUndefined()
	})

	it("returns undefined for an empty string", () => {
		expect(parseAmazonImageSize("")).toBeUndefined()
	})

	it("extracts the first match when multiple SL patterns exist", () => {
		const url = "https://cdn.example.com/_SL200_/path/_SL800_.jpg"
		expect(parseAmazonImageSize(url)).toEqual({ width: 200, height: 200 })
	})
})
