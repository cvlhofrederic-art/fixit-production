'use client'

import { useSyncExternalStore } from 'react'

/**
 * Mini-store réactif compatible avec le sous-ensemble de l'API zustand utilisé par la maquette
 * (create(initializer) et create()(initializer), sélecteurs, getState/setState/subscribe).
 * Remplace la dépendance zustand : la succursale n'a besoin que de ces primitives.
 */
export type SetState<T> = (partiel: Partial<T> | ((etat: T) => Partial<T>), remplacer?: boolean) => void
export type GetState<T> = () => T
export type Initialiseur<T> = (set: SetState<T>, get: GetState<T>, api: StoreApi<T>) => T

export interface StoreApi<T> {
  getState: GetState<T>
  setState: SetState<T>
  subscribe: (ecouteur: (etat: T, precedent: T) => void) => () => void
}

export interface UseStore<T> extends StoreApi<T> {
  (): T
  <S>(selecteur: (etat: T) => S): S
}

export function creerStoreVanille<T>(initialiseur: Initialiseur<T>): StoreApi<T> {
  let etat: T
  const ecouteurs = new Set<(etat: T, precedent: T) => void>()
  const setState: SetState<T> = (partiel, remplacer) => {
    const suivant = typeof partiel === 'function' ? partiel(etat) : partiel
    if (Object.is(suivant, etat)) return
    const precedent = etat
    etat = remplacer || typeof suivant !== 'object' || suivant === null ? (suivant as T) : { ...etat, ...suivant }
    ecouteurs.forEach((e) => e(etat, precedent))
  }
  const getState: GetState<T> = () => etat
  const subscribe: StoreApi<T>['subscribe'] = (ecouteur) => {
    ecouteurs.add(ecouteur)
    return () => {
      ecouteurs.delete(ecouteur)
    }
  }
  const api: StoreApi<T> = { getState, setState, subscribe }
  etat = initialiseur(setState, getState, api)
  return api
}

function lierHook<T>(api: StoreApi<T>): UseStore<T> {
  function useStore<S>(selecteur?: (etat: T) => S): S | T {
    // L'instantané est l'état entier (référence stable entre deux set) ; le sélecteur est appliqué
    // ensuite, ce qui évite la boucle de rendu d'un sélecteur qui renverrait un nouvel objet.
    const etat = useSyncExternalStore(api.subscribe, api.getState, api.getState)
    return selecteur ? selecteur(etat) : etat
  }
  return Object.assign(useStore as UseStore<T>, api)
}

/** Équivalent de zustand `create` : `creerStore(init)` ou `creerStore<T>()(init)`. */
export function creerStore<T>(): (initialiseur: Initialiseur<T>) => UseStore<T>
export function creerStore<T>(initialiseur: Initialiseur<T>): UseStore<T>
export function creerStore<T>(initialiseur?: Initialiseur<T>) {
  if (!initialiseur) return (init: Initialiseur<T>) => lierHook(creerStoreVanille(init))
  return lierHook(creerStoreVanille(initialiseur))
}
