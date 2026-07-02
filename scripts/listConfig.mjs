#!/usr/bin/env node
/**
 * Shared helpers for the fetch-*-list scripts: reading .env, listing the
 * available configs, and loading a --list config by its bare name. Each script
 * keeps its own per-source shape validation.
 */
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { basename, dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, "..")

/** Minimal .env reader, to avoid a dotenv dependency. */
export function loadEnv() {
	const env = {}
	let raw
	try {
		raw = readFileSync(resolve(projectRoot, ".env"), "utf8")
	} catch {
		return env
	}
	for (const line of raw.split("\n")) {
		const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
		if (!m) continue
		let val = m[2].trim()
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		)
			val = val.slice(1, -1)
		env[m[1]] = val
	}
	return env
}

/** Names of the available list configs in a dir, for the usage hint. */
export function availableConfigs(configDir) {
	try {
		return readdirSync(configDir)
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.replace(/\.json$/, ""))
	} catch {
		return []
	}
}

/**
 * Read the --list config named in argv from configDir, guarding the name against
 * path traversal. Exits with a usage / "no config" hint (listing the available
 * configs) when the name is missing or unknown. Returns the bare list name and
 * the parsed config; the caller validates the per-source shape.
 */
export function readListConfig(args, configDir) {
	const script = basename(process.argv[1] ?? "fetch-list.mjs")
	const listArg = args.indexOf("--list")
	const listName = listArg >= 0 ? args[listArg + 1] : undefined
	// Keep --list to a bare config name; it becomes a filesystem path below.
	if (!listName || /[/\\]|\.\./.test(listName)) {
		console.error(
			`Usage: node scripts/${script} --list <name>\n` +
				`Available: ${availableConfigs(configDir).join(", ") || "(none)"}`,
		)
		process.exit(1)
	}
	let config
	try {
		config = JSON.parse(
			readFileSync(resolve(configDir, `${listName}.json`), "utf8"),
		)
	} catch {
		console.error(
			`No config "${listName}". Available: ${availableConfigs(configDir).join(", ") || "(none)"}`,
		)
		process.exit(1)
	}
	return { listName, config }
}
