export interface ReviewFilters {
	search?: string
	rating?: number
	emotion?: number
	source?: string
	sort?: "date" | "rating"
}

function buildWhereClause(filters: ReviewFilters): {
	where: string
	args: (string | number)[]
} {
	const clauses: string[] = []
	const args: (string | number)[] = []

	if (filters.search) {
		clauses.push("(source_name LIKE ? OR comment LIKE ? OR meta LIKE ?)")
		const like = `%${filters.search}%`
		args.push(like, like, like)
	}

	if (typeof filters.rating === "number") {
		clauses.push("rating = ?")
		args.push(filters.rating)
	}

	if (typeof filters.emotion === "number") {
		clauses.push(`EXISTS (
      SELECT 1
        FROM json_each(reviews.emotions) AS e
       WHERE e.value = ?
    )`)
		args.push(filters.emotion)
	}

	if (filters.source) {
		clauses.push("source = ?")
		args.push(filters.source)
	}

	return {
		where: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "",
		args,
	}
}

export function buildSelectQuery(
	filters: ReviewFilters & { limit: number; offset?: number },
): { sql: string; args: (string | number)[] } {
	const { where, args } = buildWhereClause(filters)
	const orderBy =
		filters.sort === "rating"
			? " ORDER BY rating DESC, inserted_at DESC"
			: " ORDER BY inserted_at DESC"
	const sql = `SELECT * FROM reviews${where}${orderBy} LIMIT ? OFFSET ?`
	args.push(filters.limit, filters.offset ?? 0)
	return { sql, args }
}

export function buildCountQuery(filters: ReviewFilters): {
	sql: string
	args: (string | number)[]
} {
	const { where, args } = buildWhereClause(filters)
	return { sql: `SELECT COUNT(*) AS total FROM reviews${where}`, args }
}
