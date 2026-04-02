'use client'

import { Calculator } from 'lucide-react'
import dynamic from 'next/dynamic'

const SimulateurChat = dynamic(() => import('@/components/simulateur/SimulateurChat'), { ssr: false })

interface ClientSimulateurSectionProps {
  userId: string | undefined
  locale: string
  setActiveTab: (tab: string) => void
}

export default function ClientSimulateurSection({ userId, locale, setActiveTab }: ClientSimulateurSectionProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-display font-black tracking-[-0.02em] flex items-center gap-2">
          <Calculator className="w-5 h-5" />
          {locale === 'pt' ? 'Estimador de Obras' : 'Estimateur de travaux'}
        </h2>
        <p className="text-text-muted text-sm mt-1">
          {locale === 'pt'
            ? 'Descreva as suas obras e obtenha uma estimativa de preço em algumas perguntas.'
            : 'Décrivez vos travaux et obtenez une estimation de prix en quelques questions.'}
        </p>
      </div>
      <div className="bg-white rounded-2xl border-[1.5px] border-[#EFEFEF] shadow-[0_4px_30px_rgba(0,0,0,0.08)] overflow-hidden" style={{ height: '600px' }}>
        <SimulateurChat
          userId={userId}
          embedded={true}
          onPublishBourse={() => {
            setActiveTab('marches')
          }}
        />
      </div>
    </div>
  )
}
