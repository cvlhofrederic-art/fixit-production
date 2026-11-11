import type { ReactNode } from 'react'

/**
 * Page pleine de l'espace « AJ Signalement » hors coquille : états de la garde (vérification, renvoi vers la connexion,
 * session indisponible) et page de connexion professionnelle. Fond et carte de l'espace, carte centrée de 32 rem au
 * plus, 16 px de marge sur téléphone.
 */
export default function PagePleineQr({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EE] px-4 py-10" lang="fr">
      <div className="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8">{children}</div>
    </div>
  )
}
