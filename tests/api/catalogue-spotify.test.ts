import { describe, it, expect } from "vitest"
import {
	albumCoverUrl,
	buildAlbumMeta,
	type SpotifyAlbum,
} from "../../src/pages/api/catalogue/sources/spotify"

function makeAlbum(overrides: Partial<SpotifyAlbum> = {}): SpotifyAlbum {
	return {
		id: "abc",
		name: "OK Computer",
		release_date: "1997-05-21",
		images: [
			{ url: "https://img/large.jpg", width: 640, height: 640 },
			{ url: "https://img/medium.jpg", width: 300, height: 300 },
			{ url: "https://img/small.jpg", width: 64, height: 64 },
		],
		genres: ["Alternative Rock"],
		label: "Parlophone",
		artists: [{ name: "Radiohead" }],
		external_urls: { spotify: "https://open.spotify.com/album/abc" },
		...overrides,
	}
}

describe("albumCoverUrl", () => {
	it("returns the smallest image for size 'small'", () => {
		expect(albumCoverUrl(makeAlbum(), "small")).toBe("https://img/small.jpg")
	})

	it("returns the largest image for size 'large'", () => {
		expect(albumCoverUrl(makeAlbum(), "large")).toBe("https://img/large.jpg")
	})

	it("returns the middle image for the default size", () => {
		expect(albumCoverUrl(makeAlbum())).toBe("https://img/medium.jpg")
	})

	it("returns undefined when the album has no images", () => {
		expect(albumCoverUrl(makeAlbum({ images: [] }))).toBeUndefined()
	})

	it("returns the only image for every size when there is just one", () => {
		const album = makeAlbum({
			images: [{ url: "https://img/only.jpg", width: 300, height: 300 }],
		})
		expect(albumCoverUrl(album, "small")).toBe("https://img/only.jpg")
		expect(albumCoverUrl(album, "large")).toBe("https://img/only.jpg")
		expect(albumCoverUrl(album)).toBe("https://img/only.jpg")
	})
})

describe("buildAlbumMeta", () => {
	it("returns a pipe-separated string for a full album", () => {
		expect(buildAlbumMeta(makeAlbum())).toBe(
			"Radiohead | Alternative Rock | Parlophone",
		)
	})

	it("joins several artists", () => {
		const album = makeAlbum({
			artists: [{ name: "Jay-Z" }, { name: "Kanye West" }],
		})
		expect(buildAlbumMeta(album)).toBe(
			"Jay-Z, Kanye West | Alternative Rock | Parlophone",
		)
	})

	it("omits empty fields", () => {
		expect(buildAlbumMeta(makeAlbum({ genres: [], label: "" }))).toBe(
			"Radiohead",
		)
	})

	it("returns an empty string when artists, genres and label are absent", () => {
		expect(
			buildAlbumMeta(makeAlbum({ artists: [], genres: [], label: "" })),
		).toBe("")
	})
})
