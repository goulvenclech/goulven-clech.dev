import { beforeAll, afterAll, vi } from "vitest"

beforeAll(() => {
	vi.stubEnv("TURSO_URL", "libsql://test.turso.io")
	vi.stubEnv("TURSO_TOKEN", "test-token")
	vi.stubEnv("npm_package_version", "1.9.0")
})

afterAll(() => {
	vi.unstubAllEnvs()
})
