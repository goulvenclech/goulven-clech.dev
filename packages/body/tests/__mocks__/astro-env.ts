/**
 * Stand-in for "astro:env/server", which only exists inside an Astro build.
 * Aliased in vitest.config.ts.
 */
export const TURSO_URL = "file::memory:?cache=shared"
export const TURSO_TOKEN = ""
export const BODY_PASSWORD = "test-password"
