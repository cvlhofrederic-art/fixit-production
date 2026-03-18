'use client'

import React, { useRef, useState } from 'react'
import type { SignatureData } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function SignatureModal({ documentRef, signataire, onClose, onSign }: {
  documentRef: string
  signataire: string
  onClose: () => void
  onSign: (sig: SignatureData) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<{ x: number; y: number }[][]>([])
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([])
  const [nom, setNom] = useState(signataire)
  const [signing, setSigning] = useState(false)

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current; if (!canvas) return
    e.preventDefault()
    setDrawing(true)
    const pos = getPos(e, canvas)
    setCurrentStroke([pos])
    const ctx = canvas.getContext('2d')!
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
  }

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!drawing) return
    const canvas = canvasRef.current; if (!canvas) return
    e.preventDefault()
    const pos = getPos(e, canvas)
    setCurrentStroke(prev => [...prev, pos])
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e3a5f'
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
  }

  const endDraw = () => {
    if (!drawing) return
    setDrawing(false)
    setPoints(prev => [...prev, currentStroke])
    setCurrentStroke([])
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setPoints([]); setCurrentStroke([])
  }

  const buildSVG = () => {
    const paths = points.filter(s => s.length > 1).map(stroke => {
      const d = stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      return `<path d="${d}" stroke="#1e3a5f" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    }).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160">${paths}</svg>`
  }

  const handleSign = async () => {
    if (points.length === 0 || !nom.trim()) return
    setSigning(true)
    try {
      const svg = buildSVG()
      const timestamp = new Date().toISOString()
      const payload = `${nom}|${timestamp}|${documentRef}|${svg.length}`
      const encoder = new TextEncoder()
      const data = encoder.encode(payload)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      onSign({ svg_data: svg, signataire: nom, timestamp, document_ref: documentRef, hash_sha256: hash })
    } catch {
      onSign({ svg_data: buildSVG(), signataire: nom, timestamp: new Date().toISOString(), document_ref: documentRef, hash_sha256: 'hash_error' })
    }
    setSigning(false)
  }

  const isEmpty = points.length === 0

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#0D1B2E]">✍️ {t('syndicDash.signature.title')}</h3>
            <p className="text-xs text-gray-500">Conforme art. 1367 Code Civil · SHA-256</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-blue-700">📄 Document : <span className="font-semibold">{documentRef}</span></p>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Nom du signataire *</label>
          <input type="text" value={nom} onChange={e => setNom(e.target.value)} placeholder="Prénom Nom" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-[#C9A84C] focus:outline-none text-sm" />
        </div>

        <div className="mb-1">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-gray-500">Signature *</label>
            <button onClick={clearCanvas} className="text-xs text-red-500 hover:text-red-700 transition">🗑 {t('syndicDash.signature.clear')}</button>
          </div>
          <canvas ref={canvasRef} width={400} height={160}
            className={`w-full border-2 rounded-xl cursor-crosshair touch-none ${isEmpty ? 'border-dashed border-gray-300 bg-[#F7F4EE]' : 'border-[#C9A84C] bg-white'}`}
            style={{ touchAction: 'none' }}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />
          {isEmpty && <p className="text-xs text-gray-500 text-center mt-1">Signez ici avec votre souris ou votre doigt</p>}
        </div>

        <div className="bg-[#F7F4EE] rounded-xl p-3 mb-4 text-xs text-gray-500">
          🕐 Horodatage : {new Date().toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} · 🔐 SHA-256
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border-2 border-gray-200 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-[#F7F4EE] transition text-sm">{t('syndicDash.common.cancel')}</button>
          <button onClick={handleSign} disabled={isEmpty || !nom.trim() || signing}
            className="flex-1 bg-[#0D1B2E] hover:bg-[#152338] text-white py-2.5 rounded-lg font-bold transition disabled:opacity-60 text-sm">
            {signing ? '⏳ ...' : `✅ ${t('syndicDash.signature.sign')}`}
          </button>
        </div>
      </div>
    </div>
  )
}
