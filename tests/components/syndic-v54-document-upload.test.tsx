import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { useDocumentUpload } from '@/components/syndic-dashboard/v54/modules/use-document-upload'

/**
 * Vérifie le hook d'upload Léa : il POST le fichier choisi en multipart
 * vers /api/syndic/lea-documents/upload avec le bon `type`, et donne un
 * feedback toast succès / erreur. Pilote l'<input type=file> créé dynamiquement.
 */

function Harness({ type }: { type: 'contrat' | 'autre' }) {
  const upload = useDocumentUpload()
  return <button onClick={upload(type)}>upload</button>
}

let capturedInput: HTMLInputElement | null = null

beforeEach(() => {
  capturedInput = null
  const realCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const el = realCreate(tag)
    if (tag === 'input') {
      capturedInput = el as HTMLInputElement
      el.click = () => {} // neutralise l'ouverture du dialogue natif en jsdom
    }
    return el
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Déclenche le sélecteur (clic bouton) puis simule le choix d'un fichier. */
async function pickFile(file: File) {
  fireEvent.click(screen.getByText('upload'))
  expect(capturedInput).not.toBeNull()
  Object.defineProperty(capturedInput as HTMLInputElement, 'files', { value: [file], configurable: true })
  await (capturedInput as HTMLInputElement).onchange?.(new Event('change'))
}

describe('useDocumentUpload', () => {
  it('POST le fichier en multipart avec le type et toast le succès', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ document: { filename: 'contrato.pdf' }, quota: { warning: false } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ToastProvider><Harness type="contrat" /></ToastProvider>)
    await pickFile(new File(['%PDF-1.4'], 'contrato.pdf', { type: 'application/pdf' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/syndic/lea-documents/upload')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('type')).toBe('contrat')
    expect((init.body as FormData).get('file')).toBeInstanceOf(File)

    expect(await screen.findByText('Documento carregado')).toBeInTheDocument()
  })

  it('toast une erreur lisible quand l’endpoint refuse (413 quota)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'quota_exceeded' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ToastProvider><Harness type="autre" /></ToastProvider>)
    await pickFile(new File(['x'], 'big.pdf', { type: 'application/pdf' }))

    expect(await screen.findByText('Falha no carregamento')).toBeInTheDocument()
    expect(screen.getByText(/armazenamento do gabinete atingido/i)).toBeInTheDocument()
  })
})
