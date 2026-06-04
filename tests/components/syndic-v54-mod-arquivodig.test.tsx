import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ModArquivoDigital from '@/components/syndic-dashboard/v54/modules/ModArquivoDigital'

/** Étape d (batch d56) — ModArquivoDigital : arquivo digital certificado byte-exact
 * (statique : árvore de documentos + SectionDivider + ProjetoAprovSection). */

describe('ModArquivoDigital', () => {
  it('rend le titre, la árvore de documentos et un document', () => {
    render(<ModArquivoDigital />)
    expect(screen.getByRole('heading', { name: 'Arquivo Digital Certificado', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Árvore de documentos')).toBeInTheDocument()
    expect(screen.getByText('Atas')).toBeInTheDocument()
    expect(screen.getByText('Ata AG Ordinária 2025.pdf')).toBeInTheDocument()
    expect(screen.getByText('2e36304434cc...')).toBeInTheDocument()
    cleanup()
  })

  it('rend le SectionDivider + la sous-section Projeto Aprovado (alerte + état vide)', () => {
    render(<ModArquivoDigital />)
    expect(screen.getByText('Arquivo Projeto Aprovado & Licenças')).toBeInTheDocument()
    expect(screen.getByText(/DL 268\/94 art\. 2\.° — Documentos obrigatórios/)).toBeInTheDocument()
    expect(screen.getByText('Documentos autenticados')).toBeInTheDocument()
    expect(screen.getByText('Arquivo vazio')).toBeInTheDocument()
    cleanup()
  })
})
