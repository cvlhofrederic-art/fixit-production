// tests/components/syndic-v54-mod-dashboard.test.tsx
//
// Étape d — Painel de controlo (ModDashboard), page d'accueil du dashboard v54.
// On teste la structure (hero, KPIs, ações rápidas, missões, alerte) + l'action
// rapide (toast). Le rendu visuel est en Playwright.

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import ModDashboard from '@/components/syndic-dashboard/v54/modules/ModDashboard'

afterEach(cleanup)

const renderDash = () => render(<ToastProvider><ModDashboard /></ToastProvider>)

describe('syndic v54 — ModDashboard (Painel de controlo)', () => {
  it('1. hero : titre de bienvenue + stats', () => {
    renderDash()
    expect(screen.getByRole('heading', { name: /Bem-vindo/ })).toBeTruthy()
    expect(screen.getByText('Frações')).toBeTruthy()
    expect(screen.getByText('Missões ativas')).toBeTruthy()
  })

  it('2. KPIs rendus', () => {
    renderDash()
    expect(screen.getByText('Edifícios geridos')).toBeTruthy()
    expect(screen.getByText('Profissionais ativos')).toBeTruthy()
    expect(screen.getByText('Missões em curso')).toBeTruthy()
  })

  it('3. ações rápidas + missões recentes + alerte vide', () => {
    renderDash()
    expect(screen.getByRole('button', { name: /Criar missão/ })).toBeTruthy()
    expect(screen.getByText('Edifício Foz Douro')).toBeTruthy()
    expect(screen.getByText('Nenhum alerta urgente')).toBeTruthy() // Empty primitive
  })

  it('4. clic action rapide → toast', () => {
    renderDash()
    fireEvent.click(screen.getByRole('button', { name: /Criar missão/ }))
    expect(screen.getByText('Abertura do formulário de nova missão')).toBeTruthy() // desc toast (unique)
  })

  it('5. panneau orçamento (chiffres clés)', () => {
    renderDash()
    expect(screen.getByText(/Orçamento global/)).toBeTruthy()
    expect(screen.getByText('188 000')).toBeTruthy()
  })

  it('6. clic action rapide → navigue vers le module cible', () => {
    const onNavigate = vi.fn()
    render(<ToastProvider><ModDashboard onNavigate={onNavigate} /></ToastProvider>)
    fireEvent.click(screen.getByRole('button', { name: /Criar missão/ }))
    expect(onNavigate).toHaveBeenCalledWith('ordens')
  })
})
