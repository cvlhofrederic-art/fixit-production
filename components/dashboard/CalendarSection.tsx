'use client'

import { formatPrice } from '@/lib/utils'
import { useTranslation, useLocale } from '@/lib/i18n/context'

interface CalendarSectionProps {
  artisan: any
  bookings: any[]
  services: any[]
  pendingBookings: any[]
  completedBookings: any[]
  totalRevenue: number
  calendarView: 'day' | 'week' | 'month'
  setCalendarView: (v: 'day' | 'week' | 'month') => void
  selectedDay: string
  setSelectedDay: (v: string) => void
  showNewRdv: boolean
  setShowNewRdv: (v: boolean) => void
  newRdv: { client_name: string; service_id: string; date: string; time: string; address: string; notes: string; phone: string; duration: string }
  setNewRdv: (v: any) => void
  showAbsenceModal: boolean
  setShowAbsenceModal: (v: boolean) => void
  newAbsence: { start_date: string; end_date: string; reason: string; label: string }
  setNewAbsence: (v: any) => void
  showBookingDetail: boolean
  setShowBookingDetail: (v: boolean) => void
  selectedBooking: any
  setSelectedBooking: (v: any) => void
  getCalendarTitle: () => string
  navigateCalendar: (direction: number) => void
  getCalendarHours: () => string[]
  getBookingsForDate: (date: Date) => any[]
  isDateAbsent: (date: Date) => { absent: boolean; reason: string; label: string; source: string; id: string }
  getWorkingWeekDates: () => Date[]
  getMonthDays: () => { days: Date[]; firstDay: Date; lastDay: Date }
  handleEmptyCellClick: (date: Date, hour: string) => void
  handleBookingClick: (booking: any) => void
  createRdvManual: () => void
  createAbsence: () => void
  deleteAbsence: (id: string) => void
  updateBookingStatus: (bookingId: string, newStatus: string) => void
  transformBookingToDevis: (booking: any) => void
  openDashMessages: (booking: any) => void
  DAY_NAMES: string[]
  DAY_SHORT: string[]
}

export default function CalendarSection(props: CalendarSectionProps) {
  const {
    artisan, bookings, services, pendingBookings, completedBookings, totalRevenue,
    calendarView, setCalendarView, selectedDay, setSelectedDay,
    showNewRdv, setShowNewRdv, newRdv, setNewRdv,
    showAbsenceModal, setShowAbsenceModal, newAbsence, setNewAbsence,
    showBookingDetail, setShowBookingDetail, selectedBooking, setSelectedBooking,
    getCalendarTitle, navigateCalendar, getCalendarHours, getBookingsForDate,
    isDateAbsent, getWorkingWeekDates, getMonthDays,
    handleEmptyCellClick, handleBookingClick, createRdvManual, createAbsence,
    deleteAbsence, updateBookingStatus, transformBookingToDevis, openDashMessages,
    DAY_NAMES, DAY_SHORT,
  } = props

  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  // Absence reason label map (internal values are French)
  const reasonLabels: Record<string, string> = {
    'Congé': t('proDash.calendar.conge'),
    'Maladie': t('proDash.calendar.maladie'),
    'Formation': t('proDash.calendar.formation'),
    'Personnel': t('proDash.calendar.personnel'),
    'Férié': t('proDash.calendar.ferie'),
    'Autre': t('proDash.calendar.autre'),
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title={`📅 ${t('proDash.calendar.title')}`} subtitle={t('proDash.calendar.subtitle')} actionLabel={t('proDash.calendar.nouveauRdv')} onAction={() => setShowNewRdv(true)} />
      <div className="p-6 lg:p-8">

        {/* Stats cards row */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-400">
            <div className="text-sm text-gray-600 mb-1">{t('proDash.calendar.rdvAujourdhui')}</div>
            <div className="text-2xl font-bold text-gray-900">{getBookingsForDate(new Date()).length}</div>
            <div className="text-xs text-green-600 font-semibold mt-1">{getBookingsForDate(new Date()).filter(b => b.status === 'confirmed').length} {t('proDash.calendar.confirmes')}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-[#FFC107]">
            <div className="text-sm text-gray-600 mb-1">{t('proDash.calendar.tauxRemplissage')}</div>
            <div className="text-2xl font-bold text-gray-900">{bookings.length > 0 ? Math.round((bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length / bookings.length) * 100) : 0}%</div>
            <div className="text-xs text-blue-600 font-semibold mt-1">{t('proDash.calendar.cetteSemaine')}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-400">
            <div className="text-sm text-gray-600 mb-1">{t('proDash.calendar.revenusMois')}</div>
            <div className="text-2xl font-bold text-gray-900">{formatPrice(totalRevenue)}</div>
            <div className="text-xs text-green-600 font-semibold mt-1">{completedBookings.length} {t('proDash.home.terminees')}</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-amber-400">
            <div className="text-sm text-gray-600 mb-1">{t('proDash.calendar.noteMoyenne')}</div>
            <div className="text-2xl font-bold text-gray-900">{artisan?.rating_avg || '5.0'}/5</div>
            <div className="text-xs text-amber-600 font-semibold mt-1">{artisan?.rating_count || 0} {t('proDash.home.avis')}</div>
          </div>
        </div>

        {/* Calendar header */}
        <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigateCalendar(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition text-lg">{'◀'}</button>
              <h3 className="font-bold text-lg capitalize">{getCalendarTitle()}</h3>
              <button onClick={() => navigateCalendar(1)} className="p-2 hover:bg-gray-100 rounded-lg transition text-lg">{'▶'}</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-100 rounded-lg overflow-hidden">
                {(['day', 'week', 'month'] as const).map((v) => (
                  <button key={v} onClick={() => setCalendarView(v)}
                    className={`px-3 py-1.5 text-sm transition ${calendarView === v ? 'bg-[#FFC107] text-gray-900 font-semibold' : 'text-gray-500 hover:bg-gray-200'}`}>
                    {v === 'day' ? t('proDash.calendar.jour') : v === 'week' ? t('proDash.calendar.semaine') : t('proDash.calendar.mois')}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAbsenceModal(true)} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-1.5 rounded-lg font-semibold text-sm transition-all">
                {t('proDash.calendar.absence')}
              </button>
              <button onClick={() => setShowNewRdv(true)} className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-4 py-1.5 rounded-lg font-semibold text-sm shadow-sm transition-all">
                {t('proDash.calendar.nouveauRendezVous')}
              </button>
            </div>
          </div>

          {/* VUE JOUR */}
          {calendarView === 'day' && (() => {
            const dayDate = new Date(selectedDay)
            const dayBookings = getBookingsForDate(dayDate)
            const absenceInfo = isDateAbsent(dayDate)
            return (
              <div>
                <div className="p-3 text-center border-b border-gray-200 bg-gray-50">
                  <div className={`text-sm uppercase tracking-wide ${dayDate.toDateString() === new Date().toDateString() ? 'text-[#FFC107] font-bold' : 'text-gray-500'}`}>
                    {DAY_NAMES[dayDate.getDay()]}
                  </div>
                  <div className={`text-2xl font-bold mt-0.5 ${dayDate.toDateString() === new Date().toDateString() ? 'bg-[#FFC107] text-white w-10 h-10 rounded-full flex items-center justify-center mx-auto' : 'text-gray-800'}`}>
                    {dayDate.getDate()}
                  </div>
                </div>
                {absenceInfo.absent && (
                  <div className={`p-4 border-l-4 ${absenceInfo.source === 'devis' ? 'bg-red-200 border-red-600' : 'bg-red-100 border-red-400'} flex items-center justify-between`}>
                    <div>
                      <div className="font-bold text-red-800 text-sm">{absenceInfo.source === 'devis' ? `🔧 ${absenceInfo.label}` : `🚫 Absent — ${absenceInfo.reason}`}</div>
                      {absenceInfo.source === 'devis' && <div className="text-xs text-red-600">{absenceInfo.reason}</div>}
                    </div>
                    <button onClick={() => deleteAbsence(absenceInfo.id)} className="text-red-400 hover:text-red-600 text-xs">Supprimer</button>
                  </div>
                )}
                {getCalendarHours().map((hour) => {
                  const hourBookings = dayBookings.filter((b) => b.booking_time?.substring(0, 5) === hour)
                  const isEmpty = hourBookings.length === 0
                  return (
                    <div key={hour} className="grid grid-cols-[70px_1fr] border-b border-gray-100 last:border-b-0">
                      <div className="p-2 text-right pr-3 text-xs text-gray-500 font-medium border-r border-gray-100 flex items-start justify-end pt-1">
                        {hour}
                      </div>
                      <div
                        onClick={() => isEmpty && handleEmptyCellClick(dayDate, hour)}
                        className={`min-h-[70px] p-2 transition-colors group relative ${isEmpty ? 'cursor-pointer hover:bg-[#FFF9E6]' : ''}`}
                      >
                        {isEmpty && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[#FFC107] text-xl font-bold">+</span>
                          </div>
                        )}
                        {hourBookings.map((b) => {
                          const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                          const motif = b.services?.name || 'RDV'
                          const statusColors = b.status === 'confirmed' ? 'bg-[#E8F5E9] border-l-4 border-[#4CAF50]' : b.status === 'pending' ? 'bg-[#FFF3E0] border-l-4 border-[#FF9800]' : b.status === 'completed' ? 'bg-[#E3F2FD] border-l-4 border-[#2196F3]' : 'bg-red-50 border-l-4 border-red-400'
                          return (
                            <div key={b.id} onClick={() => handleBookingClick(b)}
                              className={`${statusColors} rounded-r-lg p-3 mb-1 cursor-pointer hover:shadow-md transition-all flex items-center gap-3`}>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm">{clientName}</div>
                                <div className="text-xs text-gray-600">{motif}</div>
                              </div>
                              <div className="text-right text-xs text-gray-500 shrink-0">
                                <div>{b.booking_time?.substring(0, 5)}</div>
                                {b.duration_minutes && <div>{b.duration_minutes} min</div>}
                              </div>
                              {b.price_ttc && <div className="font-bold text-sm text-green-700 shrink-0">{formatPrice(b.price_ttc)}</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* VUE SEMAINE */}
          {calendarView === 'week' && (() => {
            const weekDates = getWorkingWeekDates()
            const colCount = weekDates.length
            return (
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Day headers */}
                <div className="grid border-b border-gray-200" style={{ gridTemplateColumns: `70px repeat(${colCount}, 1fr)` }}>
                  <div className="p-2 text-center text-xs text-gray-500 border-r border-gray-100"></div>
                  {weekDates.map((date, i) => {
                    const isToday = date.toDateString() === new Date().toDateString()
                    const absInfo = isDateAbsent(date)
                    return (
                      <div key={i} onClick={() => { setSelectedDay(date.toISOString().split('T')[0]); setCalendarView('day') }}
                        className={`p-3 text-center border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-amber-50 transition ${absInfo.absent ? 'bg-red-50' : ''}`}>
                        <div className={`text-xs uppercase tracking-wide ${isToday ? 'text-[#FFC107] font-bold' : absInfo.absent ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                          {DAY_SHORT[date.getDay()]}
                        </div>
                        <div className={`text-lg font-bold mt-0.5 ${isToday ? 'bg-[#FFC107] text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : absInfo.absent ? 'text-red-600' : 'text-gray-800'}`}>
                          {date.getDate()}
                        </div>
                        {absInfo.absent && (
                          <div className="text-[9px] text-red-500 font-semibold truncate mt-0.5">{absInfo.source === 'devis' ? `🔧 ${absInfo.label}` : `🚫 ${absInfo.reason}`}</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Time grid rows */}
                {getCalendarHours().map((hour) => (
                  <div key={hour} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `70px repeat(${colCount}, 1fr)` }}>
                    <div className="p-2 text-right pr-3 text-xs text-gray-500 font-medium border-r border-gray-100 flex items-start justify-end pt-1">
                      {hour}
                    </div>
                    {weekDates.map((date, i) => {
                      const absInfo = isDateAbsent(date)
                      const dayBookings = getBookingsForDate(date)
                      const hourBookings = dayBookings.filter((b) => b.booking_time?.substring(0, 5) === hour)
                      const isEmpty = hourBookings.length === 0
                      if (absInfo.absent) {
                        return (
                          <div key={i} className={`min-h-[70px] border-r border-gray-100 last:border-r-0 p-1 ${absInfo.source === 'devis' ? 'bg-red-100' : 'bg-red-50'}`}>
                            {hour === getCalendarHours()[0] && (
                              <div className={`text-[10px] font-semibold px-1 py-0.5 rounded ${absInfo.source === 'devis' ? 'text-red-800 bg-red-200' : 'text-red-600 bg-red-100'}`}>
                                {absInfo.source === 'devis' ? `🔧 ${absInfo.label}` : `🚫 ${absInfo.reason}`}
                              </div>
                            )}
                          </div>
                        )
                      }
                      return (
                        <div
                          key={i}
                          onClick={() => isEmpty && handleEmptyCellClick(date, hour)}
                          className={`min-h-[70px] border-r border-gray-100 last:border-r-0 p-1 transition-colors group relative ${isEmpty ? 'cursor-pointer hover:bg-[#FFF9E6]' : ''}`}
                        >
                          {isEmpty && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-[#FFC107] text-xl font-bold">+</span>
                            </div>
                          )}
                          {hourBookings.map((b) => {
                            const clientName = b.notes?.match(/Client:\s*([^|.]+)/)?.[1]?.trim() || 'Client'
                            const motif = b.services?.name || 'RDV'
                            const statusColors = b.status === 'confirmed' ? 'bg-[#E8F5E9] border-l-4 border-[#4CAF50]' : b.status === 'pending' ? 'bg-[#FFF3E0] border-l-4 border-[#FF9800]' : b.status === 'completed' ? 'bg-[#E3F2FD] border-l-4 border-[#2196F3]' : 'bg-red-50 border-l-4 border-red-400'
                            return (
                              <div key={b.id} onClick={(e) => { e.stopPropagation(); handleBookingClick(b) }} className={`${statusColors} rounded-r-lg p-1.5 mb-1 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all overflow-hidden max-h-[62px]`}>
                                <div className="font-semibold text-xs truncate">{clientName}</div>
                                <div className="text-xs text-gray-600 truncate">{motif}</div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            )
          })()}

          {/* VUE MOIS */}
          {calendarView === 'month' && (() => {
            const { days, firstDay } = getMonthDays()
            const currentMonth = firstDay.getMonth()
            return (
              <div>
                {/* Day name headers */}
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                    <div key={d} className="p-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Day cells - 6 rows */}
                {Array.from({ length: 6 }, (_, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                    {days.slice(weekIdx * 7, weekIdx * 7 + 7).map((date, i) => {
                      const isCurrentMonth = date.getMonth() === currentMonth
                      const isToday = date.toDateString() === new Date().toDateString()
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6
                      const dayBookings = getBookingsForDate(date)
                      const absInfo = isDateAbsent(date)
                      return (
                        <div key={i}
                          onClick={() => { setSelectedDay(date.toISOString().split('T')[0]); setCalendarView('day') }}
                          className={`min-h-[90px] p-1.5 border-r border-gray-100 last:border-r-0 cursor-pointer transition group
                            ${absInfo.absent ? (absInfo.source === 'devis' ? 'bg-red-100' : 'bg-red-50') : !isCurrentMonth ? 'bg-gray-50/50' : isWeekend ? 'bg-[#FAFAFA]' : 'bg-white'}
                            hover:bg-[#FFF9E6]`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full
                              ${isToday ? 'bg-[#FFC107] text-white' : absInfo.absent ? 'bg-red-500 text-white' : !isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}`}>
                              {date.getDate()}
                            </span>
                            {absInfo.absent && isCurrentMonth ? (
                              <span className="text-[9px] text-red-600 font-bold">{absInfo.source === 'devis' ? '🔧' : '🚫'}</span>
                            ) : dayBookings.length > 0 && isCurrentMonth ? (
                              <span className="text-xs text-gray-500 font-semibold">{dayBookings.length}</span>
                            ) : null}
                          </div>
                          {absInfo.absent && isCurrentMonth && (
                            <div className={`text-[9px] font-semibold truncate px-1 py-0.5 rounded mb-0.5 ${absInfo.source === 'devis' ? 'text-red-800 bg-red-200' : 'text-red-600 bg-red-100'}`}>
                              {absInfo.source === 'devis' ? absInfo.label : absInfo.reason || 'Absent'}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            {dayBookings.slice(0, absInfo.absent ? 1 : 3).map((b) => {
                              const statusColor = b.status === 'confirmed' ? 'bg-green-400' : b.status === 'pending' ? 'bg-orange-400' : b.status === 'completed' ? 'bg-blue-400' : 'bg-red-400'
                              return (
                                <div key={b.id} onClick={(e) => { e.stopPropagation(); handleBookingClick(b) }}
                                  className="flex items-center gap-1 hover:opacity-80 transition">
                                  <div className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`} />
                                  <span className={`text-[10px] truncate ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {b.booking_time?.substring(0, 5)} {b.services?.name || 'RDV'}
                                  </span>
                                </div>
                              )
                            })}
                            {dayBookings.length > (absInfo.absent ? 1 : 3) && (
                              <div className="text-[10px] text-gray-500 font-semibold pl-2.5">+{dayBookings.length - (absInfo.absent ? 1 : 3)} de plus</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* RDV en attente */}
        {pendingBookings.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-lg mb-4">{'⏳'} RDV en attente de validation ({pendingBookings.length})</h3>
            <div className="space-y-3">
              {pendingBookings.map((b) => (
                <div key={b.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div>
                    <div className="font-semibold">{b.services?.name || 'Service'}</div>
                    <div className="text-sm text-gray-600">{b.booking_date} à {b.booking_time?.substring(0, 5)}</div>
                    <div className="text-sm text-gray-500">{b.address}</div>
                    {b.notes && <div className="text-xs text-gray-500 mt-1">{b.notes}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openDashMessages(b)} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-lg font-semibold text-sm transition">{'💬'} Messages</button>
                    <button onClick={() => updateBookingStatus(b.id, 'confirmed')} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition">{'✓'} Accepter</button>
                    <button onClick={() => updateBookingStatus(b.id, 'cancelled')} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-semibold text-sm transition">{'✕'} Refuser</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Nouveau RDV */}
        {showNewRdv && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewRdv(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                <h2 className="text-lg font-bold flex items-center gap-2">{'📅'} Nouveau rendez-vous</h2>
                <button onClick={() => setShowNewRdv(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">{'👤'} Client</label>
                  <input type="text" value={newRdv.client_name} onChange={(e) => setNewRdv({...newRdv, client_name: e.target.value})} placeholder="Nom du client" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">{'🔧'} Prestation *</label>
                  <select value={newRdv.service_id} onChange={(e) => setNewRdv({...newRdv, service_id: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none bg-white transition">
                    <option value="">Choisir une prestation...</option>
                    {services.filter(s => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} — {formatPrice(s.price_ttc)}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700">{'📅'} Date *</label>
                    <input type="date" value={newRdv.date} onChange={(e) => setNewRdv({...newRdv, date: e.target.value})} min={new Date().toISOString().split('T')[0]} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700">{'🕐'} Heure *</label>
                    <input type="time" value={newRdv.time} onChange={(e) => setNewRdv({...newRdv, time: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700">{'⏱️'} Durée</label>
                    <select value={newRdv.duration} onChange={(e) => setNewRdv({...newRdv, duration: e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none bg-white transition">
                      <option value="">Auto</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">1h</option>
                      <option value="90">1h30</option>
                      <option value="120">2h</option>
                      <option value="180">3h</option>
                      <option value="240">Demi-journée</option>
                      <option value="480">Journée</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700">{'📞'} Téléphone</label>
                    <input type="tel" value={newRdv.phone} onChange={(e) => setNewRdv({...newRdv, phone: e.target.value})} placeholder="06 12 34 56 78" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700">{'📍'} Adresse</label>
                    <input type="text" value={newRdv.address} onChange={(e) => setNewRdv({...newRdv, address: e.target.value})} placeholder="Adresse intervention" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">{'📝'} Notes</label>
                  <textarea value={newRdv.notes} onChange={(e) => setNewRdv({...newRdv, notes: e.target.value})} rows={2} placeholder="Détails, accès, infos utiles..." className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#FFC107] focus:outline-none resize-none transition" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
                <button onClick={createRdvManual} disabled={!newRdv.service_id || !newRdv.date || !newRdv.time} className="flex-1 bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                  {'✓'} Créer le rendez-vous
                </button>
                <button onClick={() => setShowNewRdv(false)} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition text-sm">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Absence */}
        {showAbsenceModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAbsenceModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">{'🚫'} Ajouter une absence</h2>
                <button onClick={() => setShowAbsenceModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Motif</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Congé', 'Maladie', 'Formation', 'Personnel', 'Férié', 'Autre'].map(reason => (
                      <button key={reason} onClick={() => setNewAbsence({...newAbsence, reason})}
                        className={`p-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${newAbsence.reason === reason ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                        {reason === 'Congé' ? '🏖️' : reason === 'Maladie' ? '🤒' : reason === 'Formation' ? '📚' : reason === 'Personnel' ? '🏠' : reason === 'Férié' ? '🎉' : '📌'} {reason}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700">Du *</label>
                    <input type="date" value={newAbsence.start_date} onChange={(e) => setNewAbsence({...newAbsence, start_date: e.target.value, end_date: newAbsence.end_date || e.target.value})} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1 text-gray-700">Au *</label>
                    <input type="date" value={newAbsence.end_date} onChange={(e) => setNewAbsence({...newAbsence, end_date: e.target.value})} min={newAbsence.start_date} className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none transition" />
                  </div>
                </div>
                {newAbsence.start_date && newAbsence.end_date && (
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl text-center">
                    {(() => {
                      const start = new Date(newAbsence.start_date)
                      const end = new Date(newAbsence.end_date)
                      const daysCount = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
                      return `📅 ${daysCount} jour${daysCount > 1 ? 's' : ''} d'absence`
                    })()}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">Libellé <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <input type="text" value={newAbsence.label} onChange={(e) => setNewAbsence({...newAbsence, label: e.target.value})} placeholder="Ex: Vacances d'été, RDV médical..." className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none transition" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <button onClick={createAbsence} disabled={!newAbsence.start_date || !newAbsence.end_date} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                  {'🚫'} Bloquer ces dates
                </button>
                <button onClick={() => setShowAbsenceModal(false)} className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition text-sm">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Detail RDV */}
        {showBookingDetail && selectedBooking && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }}>
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{'📋'} Détail du rendez-vous</h2>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-semibold ${
                    selectedBooking.status === 'confirmed' ? 'bg-green-50 text-green-700' :
                    selectedBooking.status === 'pending' ? 'bg-amber-50 text-orange-700' :
                    selectedBooking.status === 'completed' ? 'bg-blue-50 text-blue-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {selectedBooking.status === 'confirmed' ? '✅ Confirmé' :
                     selectedBooking.status === 'pending' ? '⏳ En attente' :
                     selectedBooking.status === 'completed' ? '✓ Terminé' : '✕ Annulé'}
                  </span>
                </div>
                <button onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }} className="text-gray-500 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-xl">{'🔧'}</span>
                  <div>
                    <div className="text-xs text-gray-500">Motif</div>
                    <div className="font-semibold">{selectedBooking.services?.name || 'Service'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{'📅'}</span>
                    <div>
                      <div className="text-xs text-gray-500">Date</div>
                      <div className="font-semibold">{new Date(selectedBooking.booking_date).toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{'🕐'}</span>
                    <div>
                      <div className="text-xs text-gray-500">Heure</div>
                      <div className="font-semibold">{selectedBooking.booking_time?.substring(0, 5)}</div>
                    </div>
                  </div>
                </div>
                {selectedBooking.duration_minutes && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{'⏱️'}</span>
                    <div>
                      <div className="text-xs text-gray-500">Durée</div>
                      <div className="font-semibold">{Math.floor(selectedBooking.duration_minutes / 60)}h{selectedBooking.duration_minutes % 60 > 0 ? String(selectedBooking.duration_minutes % 60).padStart(2, '0') : '00'}</div>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-xl">{'📍'}</span>
                  <div>
                    <div className="text-xs text-gray-500">Adresse</div>
                    <div className="font-semibold">{selectedBooking.address || 'Non renseignée'}</div>
                  </div>
                </div>
                {selectedBooking.notes && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xl">{'📝'}</span>
                    <div>
                      <div className="text-xs text-gray-500">Notes</div>
                      <div className="text-sm text-gray-700">{selectedBooking.notes}</div>
                    </div>
                  </div>
                )}
                {selectedBooking.price_ttc && (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                    <span className="text-xl">{'💰'}</span>
                    <div>
                      <div className="text-xs text-gray-500">Montant TTC</div>
                      <div className="font-bold text-lg text-green-700">{formatPrice(selectedBooking.price_ttc)}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {selectedBooking.status === 'pending' && (
                  <>
                    <button onClick={() => { setShowBookingDetail(false); transformBookingToDevis(selectedBooking) }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                      {'📄'} Transformer en devis
                    </button>
                    <button onClick={() => updateBookingStatus(selectedBooking.id, 'confirmed')}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition">
                      {'✓'} Confirmer
                    </button>
                    <button onClick={() => updateBookingStatus(selectedBooking.id, 'cancelled')}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-3 rounded-lg font-semibold border-2 border-red-200 transition">
                      {'✕'} Refuser
                    </button>
                  </>
                )}
                {selectedBooking.status === 'confirmed' && (
                  <>
                    <button onClick={() => { setShowBookingDetail(false); transformBookingToDevis(selectedBooking) }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                      {'📄'} Transformer en devis
                    </button>
                    <button onClick={() => updateBookingStatus(selectedBooking.id, 'completed')}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition">
                      {'✓'} Marquer terminé
                    </button>
                    <button onClick={() => { if (confirm('Annuler ce rendez-vous ?')) updateBookingStatus(selectedBooking.id, 'cancelled') }}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-3 rounded-lg font-semibold border-2 border-red-200 transition">
                      {'✕'} Annuler le RDV
                    </button>
                  </>
                )}
                {selectedBooking.status === 'completed' && (
                  <div className="w-full text-center text-gray-500 py-2 text-sm">Ce RDV est terminé</div>
                )}
                {selectedBooking.status === 'cancelled' && (
                  <button onClick={() => updateBookingStatus(selectedBooking.id, 'pending')}
                    className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 py-3 rounded-lg font-semibold border-2 border-amber-200 transition">
                    {'🔄'} Remettre en attente
                  </button>
                )}
                <button onClick={() => { setShowBookingDetail(false); setSelectedBooking(null) }}
                  className="w-full mt-1 px-6 py-2.5 bg-white text-gray-500 border-2 border-gray-200 rounded-lg font-semibold hover:bg-gray-50 transition text-sm">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle?: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="bg-white px-6 lg:px-10 h-20 border-b border-[#34495E] flex justify-between items-center">
      <div>
        <h1 className="text-xl font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <button onClick={onAction}
        className="bg-[#FFC107] hover:bg-[#FFD54F] text-gray-900 px-5 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all text-sm">
        {actionLabel}
      </button>
    </div>
  )
}
