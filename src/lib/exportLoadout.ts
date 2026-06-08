import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import ExportCard, { type ExportCardInput } from '@/components/ExportCard/ExportCard'

export type { ExportCardInput }

export type ExportResult = 'shared' | 'downloaded' | 'cancelled' | 'error'

// Web Share with files is the right UX on phones/tablets (native share sheet),
// but several desktop browsers (Edge/Chrome on Windows) also report support and
// pop the OS share sheet — which has no obvious "save image" path. Per PRD §8.5
// we want desktop = direct download, mobile = share sheet, so gate sharing on an
// actual mobile/touch device rather than on canShare alone.
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return mobileUA || iPadOS
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

// Render the share card off-screen, rasterize it, and share (mobile Web Share
// with files) or download (PRD §8.5–8.6). The card is text-only, so there are no
// external resources to inline — html2canvas captures it directly.
export async function exportLoadout(input: ExportCardInput): Promise<ExportResult> {
  // Lazy-load html2canvas so its ~200KB stays out of the initial bundle and is
  // only fetched the first time someone exports.
  const { default: html2canvas } = await import('html2canvas')

  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.pointerEvents = 'none'
  document.body.appendChild(host)
  const root = createRoot(host)

  try {
    // Render, then wait two frames so layout settles before capture.
    await new Promise<void>(resolve => {
      root.render(createElement(ExportCard, { input }))
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    const target = host.firstElementChild as HTMLElement | null
    if (!target) return 'error'

    const canvas = await html2canvas(target, {
      scale: 2, // crisp in Discord/Twitter previews
      backgroundColor: '#0e1117',
      logging: false,
    })

    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
    if (!blob) return 'error'

    const fileName = `hellpod-companion-loadout-${Date.now()}.png`
    const file = new File([blob], fileName, { type: 'image/png' })

    if (isMobileDevice() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Hellpod Companion loadout' })
        return 'shared'
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
        // Any other share failure: fall through to a download so the user still gets the image.
      }
    }

    downloadBlob(blob, fileName)
    return 'downloaded'
  } catch {
    return 'error'
  } finally {
    root.unmount()
    host.remove()
  }
}
