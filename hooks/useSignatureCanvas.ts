'use client'

import { useState, useCallback, type RefObject } from 'react'

interface Point { x: number; y: number }

export function useSignatureCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [sigDrawing, setSigDrawing] = useState(false)
  const [sigPoints, setSigPoints] = useState<Point[][]>([])
  const [sigCurrentStroke, setSigCurrentStroke] = useState<Point[]>([])

  const getSigPos = useCallback((e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement): Point => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY }
  }, [])

  const sigStartDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    setSigDrawing(true)
    const pos = getSigPos(e, canvas)
    setSigCurrentStroke([pos])
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [canvasRef, getSigPos])

  const sigDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!sigDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    const pos = getSigPos(e, canvas)
    setSigCurrentStroke(prev => [...prev, pos])
    const ctx = canvas.getContext('2d')!
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1E293B'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }, [sigDrawing, canvasRef, getSigPos])

  const sigEndDraw = useCallback(() => {
    if (!sigDrawing) return
    setSigDrawing(false)
    setSigPoints(prev => [...prev, sigCurrentStroke])
    setSigCurrentStroke([])
  }, [sigDrawing, sigCurrentStroke])

  const sigClearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSigPoints([])
    setSigCurrentStroke([])
  }, [canvasRef])

  const sigBuildSVG = useCallback((): string => {
    const paths = sigPoints.filter(s => s.length > 1).map(stroke => {
      const d = stroke.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
      return `<path d="${d}" stroke="#1E293B" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    }).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140">${paths}</svg>`
  }, [sigPoints])

  const hasSignature = sigPoints.length > 0

  return {
    sigDrawing,
    sigPoints,
    sigStartDraw,
    sigDraw,
    sigEndDraw,
    sigClearCanvas,
    sigBuildSVG,
    hasSignature,
  }
}
