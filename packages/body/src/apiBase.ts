/** The sync backend lives on the main site — in dev, its local server. */
export const API_BASE = import.meta.env.DEV
	? "http://localhost:4321"
	: "https://goulven-clech.dev"

/** Push batch cap — the server rejects bigger batches. */
export const LOG_PAGE = 500
