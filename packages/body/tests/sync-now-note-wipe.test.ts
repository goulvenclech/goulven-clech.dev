// @vitest-environment happy-dom
import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHistory } from "$src/client/history"
import { memoryStorage } from "./memoryStorage"

beforeEach(() => {
	globalThis.indexedDB = new IDBFactory()
	vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
	vi.stubGlobal("localStorage", memoryStorage())
	localStorage.setItem("body-sync-token", "some-token")
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

describe("sync-now offline feedback", () => {
	it("keeps the offline message visible after the sync attempt", async () => {
		const root = document.createElement("div")
		await renderHistory(root, false)

		const button = [...root.querySelectorAll("button")].find(
			(candidate) => candidate.textContent === "Sync now",
		)
		if (!button) throw new Error("Sync now button not rendered")

		button.click()
		await settle()

		expect(root.textContent).toContain("Offline — will retry")
	})
})
