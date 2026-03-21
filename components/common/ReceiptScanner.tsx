'use client'

import { useState, useRef, useCallback } from 'react'
import { Camera, Upload, X, Check, Loader2, ReceiptText, Percent } from 'lucide-react'

// ── Types ──

export interface ScannedLine {
  name: string
  qty: number
  unit: string
  unitPrice: number
  totalPrice: number
  selected: boolean
}

interface ReceiptScanResult {
  store: string
  date: string
  lines: Array<{
    name: string
    qty: number
    unit: string
    unitPrice: number
    totalPrice: number
  }>
  totalHT?: number
  totalTTC: number
  confidence: 'haute' | 'moyenne' | 'basse'
}

// ── Exported line for devis injection ──

export interface DevisReceiptLine {
  description: string
  qty: number
  unit: string
  priceHT: number  // unitPrice * (1 + margin/100)
  totalHT: number
}

interface ReceiptScannerProps {
  onInject: (lines: DevisReceiptLine[], storeName?: string) => void
  onClose: () => void
  mode?: 'modal' | 'inline'
}

export default function ReceiptScanner({ onInject, onClose, mode = 'modal' }: ReceiptScannerProps) {
  const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload')
  const [scannedLines, setScannedLines] = useState<ScannedLine[]>([])
  const [storeName, setStoreName] = useState('')
  const [storeDate, setStoreDate] = useState('')
  const [totalTTC, setTotalTTC] = useState(0)
  const [confidence, setConfidence] = useState<string>('')
  const [margin, setMargin] = useState(15)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    setError('')
    setStep('scanning')

    // Preview
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      setPreviewUrl(base64)

      try {
        const res = await fetch('/api/receipt-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64,
            mime_type: file.type || 'image/jpeg',
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Erreur ${res.status}`)
        }

        const data = await res.json()
        const result: ReceiptScanResult = data.result

        if (!result || result.lines.length === 0) {
          setError('Aucun article trouvé sur le ticket. Essayez avec une photo plus nette.')
          setStep('upload')
          return
        }

        setStoreName(result.store || 'Magasin inconnu')
        setStoreDate(result.date || '')
        setTotalTTC(result.totalTTC || 0)
        setConfidence(result.confidence)
        setScannedLines(result.lines.map(l => ({
          ...l,
          selected: true,
        })))
        setStep('review')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur inconnue'
        setError(msg)
        setStep('upload')
      }
    }
    reader.readAsDataURL(file)
  }, [])

  const toggleLine = (idx: number) => {
    setScannedLines(prev => prev.map((l, i) => i === idx ? { ...l, selected: !l.selected } : l))
  }

  const toggleAll = () => {
    const allSelected = scannedLines.every(l => l.selected)
    setScannedLines(prev => prev.map(l => ({ ...l, selected: !allSelected })))
  }

  const selectedLines = scannedLines.filter(l => l.selected)

  const getResellingPrice = (unitPrice: number) => {
    return Math.round(unitPrice * (1 + margin / 100) * 100) / 100
  }

  const handleInject = () => {
    const devisLines: DevisReceiptLine[] = selectedLines.map(l => {
      const priceWithMargin = getResellingPrice(l.unitPrice)
      return {
        description: l.name,
        qty: l.qty,
        unit: l.unit,
        priceHT: priceWithMargin,
        totalHT: Math.round(priceWithMargin * l.qty * 100) / 100,
      }
    })
    onInject(devisLines, storeName)
  }

  const totalAchat = selectedLines.reduce((s, l) => s + l.totalPrice, 0)
  const totalRevente = selectedLines.reduce((s, l) => s + getResellingPrice(l.unitPrice) * l.qty, 0)
  const totalMarge = totalRevente - totalAchat

  const containerClass = mode === 'modal'
    ? 'fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'
    : ''

  return (
    <div className={containerClass}>
      <div className={`bg-white rounded-2xl shadow-2xl overflow-hidden ${mode === 'modal' ? 'w-full max-w-lg max-h-[90vh] flex flex-col' : 'w-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-amber-500 to-yellow-400">
          <div className="flex items-center gap-2 text-white">
            <ReceiptText className="w-5 h-5" />
            <span className="font-semibold text-sm">Scanner ticket de caisse</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <p className="text-sm text-gray-600 text-center">
                Prenez en photo votre ticket de caisse ou importez une image/PDF
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-amber-300 rounded-xl hover:bg-amber-50 transition"
                >
                  <Camera className="w-8 h-8 text-amber-600" />
                  <span className="text-sm font-medium text-gray-700">Photo</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 transition"
                >
                  <Upload className="w-8 h-8 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Importer</span>
                </button>
              </div>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          )}

          {/* STEP 2: Scanning */}
          {step === 'scanning' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Analyse du ticket en cours...</p>
              {previewUrl && (
                <img src={previewUrl} alt="Ticket" className="w-32 h-auto rounded-lg border shadow-sm" />
              )}
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Store info */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                <div>
                  <p className="font-semibold text-sm">{storeName}</p>
                  {storeDate && <p className="text-xs text-gray-500">{storeDate}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  confidence === 'haute' ? 'bg-green-100 text-green-700' :
                  confidence === 'moyenne' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {confidence === 'haute' ? 'Confiance haute' : confidence === 'moyenne' ? 'Confiance moyenne' : 'Confiance basse'}
                </span>
              </div>

              {/* Margin control */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Marge de revente</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="flex-1 accent-amber-500"
                  />
                  <div className="flex items-center gap-1 bg-white border border-amber-300 rounded-lg px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={margin}
                      onChange={(e) => setMargin(Math.max(0, Math.min(200, Number(e.target.value))))}
                      className="w-12 text-center text-sm font-bold text-amber-700 outline-none"
                    />
                    <span className="text-amber-600 text-sm">%</span>
                  </div>
                </div>
              </div>

              {/* Lines list */}
              <div className="border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b">
                  <button
                    onClick={toggleAll}
                    className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                  >
                    {scannedLines.every(l => l.selected) ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                  <span className="text-xs text-gray-500">{selectedLines.length}/{scannedLines.length} articles</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {scannedLines.map((line, idx) => (
                    <div
                      key={idx}
                      onClick={() => toggleLine(idx)}
                      className={`flex items-start gap-3 px-3 py-2.5 border-b last:border-0 cursor-pointer transition ${
                        line.selected ? 'bg-amber-50/50' : 'bg-white opacity-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        line.selected ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300'
                      }`}>
                        {line.selected && <Check className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{line.name}</p>
                        <p className="text-xs text-gray-500">
                          {line.qty} {line.unit} x {line.unitPrice.toFixed(2)} EUR
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400 line-through">{line.totalPrice.toFixed(2)} EUR</p>
                        <p className="text-sm font-bold text-amber-700">
                          {(getResellingPrice(line.unitPrice) * line.qty).toFixed(2)} EUR
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Prix achat</span>
                  <span className="font-medium">{totalAchat.toFixed(2)} EUR</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Prix revente (+{margin}%)</span>
                  <span className="font-medium text-amber-700">{totalRevente.toFixed(2)} EUR</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-1.5">
                  <span className="text-green-700 font-medium">Marge brute</span>
                  <span className="font-bold text-green-700">+{totalMarge.toFixed(2)} EUR</span>
                </div>
                {totalTTC > 0 && totalTTC !== totalAchat && (
                  <p className="text-[10px] text-gray-400 text-right">Total ticket : {totalTTC.toFixed(2)} EUR</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === 'review' && selectedLines.length > 0 && (
          <div className="px-5 py-4 border-t bg-white">
            <button
              onClick={handleInject}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              <ReceiptText className="w-4 h-4" />
              Injecter {selectedLines.length} article{selectedLines.length > 1 ? 's' : ''} dans le devis
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
