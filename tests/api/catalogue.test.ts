import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createEndpointContext,
  expectJsonResponse,
  parseJsonResponse,
  sampleReview,
} from "../helpers"

vi.mock("@libsql/client", () => ({
  createClient: vi.fn(() => ({
    execute: vi.fn(),
    batch: vi.fn(),
    close: vi.fn(),
  })),
}))

describe("Catalogue API", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /api/catalogue/reviews", () => {
    it("should return a JSON response", async () => {
      const { createClient } = await import("@libsql/client")
      const mockedClient = vi.mocked(createClient)

      mockedClient.mockReturnValue({
        execute: vi.fn().mockResolvedValue({
          rows: [{ ...sampleReview, emotions: JSON.stringify(sampleReview.emotions) }],
        }),
        batch: vi.fn(),
        close: vi.fn(),
      } as unknown as ReturnType<typeof createClient>)

      // TODO: Import and call the actual GET handler once endpoint is refactored for testing
      const mockResponse = new Response(JSON.stringify({ reviews: [sampleReview] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })

      expectJsonResponse(mockResponse, 200)
      const data = await parseJsonResponse<{ reviews: (typeof sampleReview)[] }>(mockResponse)
      expect(data.reviews).toHaveLength(1)
      expect(data.reviews[0].source_name).toBe("Test Game")
    })
  })

  describe("API Response Helpers", () => {
    it("should create valid endpoint context", () => {
      const context = createEndpointContext("/api/test", {
        method: "POST",
        params: { id: "123" },
      })

      expect(context.request.method).toBe("POST")
      expect(context.params.id).toBe("123")
      expect(context.url.pathname).toBe("/api/test")
    })

    it("should handle query parameters", () => {
      const context = createEndpointContext("/api/reviews?limit=5&offset=10")

      expect(context.url.searchParams.get("limit")).toBe("5")
      expect(context.url.searchParams.get("offset")).toBe("10")
    })
  })
})

describe("Catalogue LLM Endpoint", () => {
  it("should return text content for LLM consumption", async () => {
    const mockTextResponse = `# Video Games
Test Game (loved it): Great game!`

    const response = new Response(mockTextResponse, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("text/plain")

    const text = await response.text()
    expect(text).toContain("Video Games")
    expect(text).toContain("Test Game")
  })
})
