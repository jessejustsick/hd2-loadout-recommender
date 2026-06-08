import type { FactionId } from '@/types'
// URL form for live <img> in the UI; ?raw form (inline SVG markup) for inlining
// into the off-screen export card so html2canvas rasterizes it reliably.
import terminidsUrl from '@/assets/factions/terminids.svg'
import automatonsUrl from '@/assets/factions/automatons.svg'
import illuminateUrl from '@/assets/factions/illuminate.svg'
import terminidsRaw from '@/assets/factions/terminids.svg?raw'
import automatonsRaw from '@/assets/factions/automatons.svg?raw'
import illuminateRaw from '@/assets/factions/illuminate.svg?raw'

export const factionIconUrl: Record<FactionId, string> = {
  terminids: terminidsUrl,
  automatons: automatonsUrl,
  illuminate: illuminateUrl,
}

const factionIconRaw: Record<FactionId, string> = {
  terminids: terminidsRaw,
  automatons: automatonsRaw,
  illuminate: illuminateRaw,
}

// Rasterize the faction glyph to a PNG data URL for the export card. html2canvas
// doesn't reliably render inline SVG <img> (these SVGs carry only a viewBox, no
// width/height, so it sizes them wrong) — a PNG always rasterizes. We inject
// explicit dimensions, draw the SVG to a canvas, and read back a PNG. Returns
// null on any failure so the card just omits the icon rather than breaking.
export function factionIconPng(faction: FactionId, size = 48): Promise<string | null> {
  const sized = factionIconRaw[faction].replace('<svg ', '<svg width="512" height="512" ')
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, size, size)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = svgUrl
  })
}
