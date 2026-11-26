'use client'

// CRM du secrétariat (22/11/2026) : écran de la secrétaire (compte « secretariat ») et du super admin.
// Route interne sans langue, comme le panneau admin (robots : /admin/ exclu). Droits vérifiés par app/api/crm/*.

import EcranCrm from '@/components/crm/EcranCrm'

export default function PageCrm() {
  return <EcranCrm />
}
