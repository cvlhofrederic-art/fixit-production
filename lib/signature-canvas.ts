// Conversion d'une chaîne SVG (signature manuscrite) en data URL PNG @2x via
// canvas. Extrait à l'identique (octet pour octet) de DevisFactureForm et
// DevisFactureFormBTP — audit 2026-06-10, Vague 4. Helper DOM pur, aucune
// logique métier → mutualisation sans impact RÈGLE #1 (artisan vs BTP).
export function svgToImageDataUrl(svgString: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2
      canvas.height = height * 2
      const ctx = canvas.getContext('2d')!
      ctx.scale(2, 2)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')) }
    img.src = url
  })
}
