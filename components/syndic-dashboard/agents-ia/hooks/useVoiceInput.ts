// components/syndic-dashboard/agents-ia/hooks/useVoiceInput.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Locale } from '@/lib/syndic/agent-types'

interface UseVoiceInputOptions {
  locale: Locale
  onTranscript: (text: string, isFinal: boolean) => void
  autoSubmitOnSilence?: number
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: typeof SpeechRecognition
  webkitSpeechRecognition?: typeof SpeechRecognition
}

function getSpeechRecognition(): typeof SpeechRecognition | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as WindowWithSpeech
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function useVoiceInput({ locale, onTranscript, autoSubmitOnSilence }: UseVoiceInputOptions) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSupported(!!getSpeechRecognition())
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    const SR = getSpeechRecognition()
    if (!SR) {
      setError('voice_unsupported')
      return
    }

    const recognition = new SR()
    recognition.lang = locale === 'pt' ? 'pt-PT' : 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }
      if (interim) onTranscript(interim, false)
      if (final) {
        onTranscript(final, true)
        if (autoSubmitOnSilence) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = setTimeout(() => stop(), autoSubmitOnSilence)
        }
      }
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setError(e.error)
      setListening(false)
    }

    recognition.onend = () => setListening(false)

    recognition.start()
    recognitionRef.current = recognition
    setListening(true)
    setError(null)
  }, [locale, onTranscript, autoSubmitOnSilence, stop])

  useEffect(() => () => stop(), [stop])

  return { supported, listening, error, start, stop }
}
