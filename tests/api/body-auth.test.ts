// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { OPTIONS, POST } from "../../src/pages/api/body/auth"
import { deriveSyncToken } from "../../src/bodyLog"
import { createEndpointContext, parseJsonResponse } from "../helpers"

vi.stubEnv("CATALOGUE_PASSWORD", "secret")
vi.stubEnv("BODY_SYNC_SECRET", "stub-sync-secret")

const post = (body: BodyInit, origin?: string) =>
	POST(
		createEndpointContext("/api/body/auth", {
			method: "POST",
			body,
			headers: origin ? { origin } : {},
		}),
	)

describe("POST /api/body/auth", () => {
	it("exchanges the shared password for the sync token", async () => {
		const response = await post(JSON.stringify({ password: "secret" }))
		expect(response.status).toBe(200)
		const body = await parseJsonResponse<{ token: string }>(response)
		expect(body.token).toBe(deriveSyncToken("stub-sync-secret", "secret"))
		expect(response.headers.get("Cache-Control")).toBe("no-store")
	})

	it("rejects a wrong or missing password", async () => {
		expect((await post(JSON.stringify({ password: "nope" }))).status).toBe(401)
		expect((await post(JSON.stringify({}))).status).toBe(401)
	})

	it("rejects a malformed body as a 400", async () => {
		expect((await post("not json")).status).toBe(400)
	})

	it("carries CORS headers for the tracker's origin", async () => {
		const response = await post(
			JSON.stringify({ password: "secret" }),
			"https://body.goulven-clech.dev",
		)
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://body.goulven-clech.dev",
		)
	})

	it("answers preflight", () => {
		const response = OPTIONS(
			createEndpointContext("/api/body/auth", {
				method: "OPTIONS",
				headers: { origin: "http://localhost:4322" },
			}),
		)
		expect(response.status).toBe(204)
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
			"POST",
		)
	})
})
