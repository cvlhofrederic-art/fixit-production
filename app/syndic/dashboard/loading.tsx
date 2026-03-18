export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F2F2F0' }}>
      <div className="text-center">
        <div className="inline-flex items-center gap-3 px-6 py-4 bg-white rounded-2xl shadow-sm">
          <div className="w-5 h-5 border-2 border-[#FFC107] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-gray-600">Chargement du portail syndic…</span>
        </div>
      </div>
    </div>
  )
}
