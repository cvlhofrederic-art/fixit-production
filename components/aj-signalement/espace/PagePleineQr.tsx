import type { ReactNode } from 'react'

/**
 * Page pleine de l'espace « AJ Signalement » hors coquille : états de la garde (vérification, renvoi vers la connexion,
 * session indisponible) et page de connexion professionnelle. Fond et carte de l'espace, carte centrée de 32 rem au
 * plus, 16 px de marge sur téléphone. `titre` : h1 lu par les lecteurs d'écran, non affiché (un titre par page, sans
 * rien changer à l'écran ; états pleine page de l'espace d'un cabinet, relecture du lot 6).
 */
export default function PagePleineQr({ children, titre }: Readonly<{ children: ReactNode; titre?: string }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EE] px-4 py-10" lang="fr">
      <div className="w-full max-w-lg rounded-2xl border border-[#E4DDD0] bg-white p-6 shadow-sm md:p-8">
        {titre && <h1 className="sr-only">{titre}</h1>}
        {children}
      </div>
    </div>
  )
}
