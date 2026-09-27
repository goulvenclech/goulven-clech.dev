import type { HTMLTag } from "astro/types"

/**
 * Each variant pairs its colour with a shape and, except the solid primary, a
 * texture, so colour is never the only cue.
 */
export const markerVariants = ["primary", "warning", "success", "info"] as const

export type MarkerVariant = (typeof markerVariants)[number]

export const textureIds: Partial<Record<MarkerVariant, string>> = {
	warning: "texture-warning",
	success: "texture-success",
	info: "texture-info",
}

export function isMarkerVariant(name: string): name is MarkerVariant {
	return (markerVariants as readonly string[]).includes(name)
}

export function markerTag(variant: MarkerVariant = "primary"): HTMLTag {
	return `marker-${variant}` as HTMLTag
}
