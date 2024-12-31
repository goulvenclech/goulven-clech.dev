import type { LocalImageService } from "astro"
import sharpService from "astro/assets/services/sharp"
import { readFileSync } from "fs"
import sharp from "sharp"
/**
 * ⚠️ Warning for beginners ⚠️
 * What you're about to read here is an overly complicated and far-fetched way of
 * displaying images with Astro. Mainly to gain performance and to display a
 * placeholder during image loading.
 * You should rather use the default utils for images :
 * -> https://docs.astro.build/en/guides/images/
 * This service is used at :
 * -> src/components/images/FigImage.astro
 */
/**
 * A custom LocalImageService based on Sharp, fully retrieved from my friend Erika's blog
 * See -> https://github.com/Princesseuh/erika.florist
 */
function getBitmapDimensions(
  imgWidth: number,
  imgHeight: number,
  pixelTarget: number
): { width: number; height: number } {
  // Aims for a bitmap of ~P pixels (w * h = ~P).
  // Gets the ratio of the width to the height. (r = w0 / h0 = w / h)
  const ratioWH = imgWidth / imgHeight
  // Express the width in terms of height by multiply the ratio by the
  // height. (h * r = (w / h) * h)
  // Plug this representation of the width into the original equation.
  // (h * r * h = ~P).
  // Divide the bitmap size by the ratio to get the all expressions using
  // height on one side. (h * h = ~P / r)
  let bitmapHeight = pixelTarget / ratioWH
  // Take the square root of the height instances to find the singular value
  // for the height. (h = sqrt(~P / r))
  bitmapHeight = Math.sqrt(bitmapHeight)
  // Divide the goal total pixel amount by the height to get the width.
  // (w = ~P / h).
  const bitmapWidth = pixelTarget / bitmapHeight
  return { width: Math.round(bitmapWidth), height: Math.round(bitmapHeight) }
}

export interface LocalImageServiceWithPlaceholder extends LocalImageService {
  generatePlaceholder: (
    src: string,
    width: number,
    height: number,
    quality?: number
  ) => Promise<string>
}

const service: LocalImageServiceWithPlaceholder = {
  ...sharpService,
  generatePlaceholder: async (src: string, width: number, height: number, quality = 100) => {
    const placeholderDimensions = getBitmapDimensions(width, height, quality)

    // HACK: It'd be nice to be able to get a Buffer out from an ESM import or `getImage`, wonder how we could do that..
    const originalFileBuffer = import.meta.env.PROD
      ? readFileSync("./dist/" + src)
      : await fetch(new URL(src, "http://localhost:4321/"))
          .then((response) => response.arrayBuffer())
          .then((buffer) => Buffer.from(buffer))

    const placeholderBuffer = await sharp(originalFileBuffer)
      .resize(placeholderDimensions.width, placeholderDimensions.height, { fit: "inside" })
      .toFormat("webp", { quality: 1 })
      .modulate({
        brightness: 1,
        saturation: 1.2,
      })
      .blur()
      .toBuffer({ resolveWithObject: true })

    return `data:image/${placeholderBuffer.info.format};base64,${placeholderBuffer.data.toString(
      "base64"
    )}`
  },
}

export default service
