'use client'

import { useState, useCallback } from 'react'
import type { Availability } from '@/lib/types'

export function useCalendar(
  bookings: any[],
  availability: any[],
  dateFmtLocale: string,
  t: (key: string) => string,
) {
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week')
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.setDate(diff)).toISOString().split('T')[0]
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const changeWeek = useCallback((direction: number) => {
    setSelectedWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + direction * 7)
      return d.toISOString().split('T')[0]
    })
  }, [])

  const changeDay = useCallback((direction: number) => {
    setSelectedDay(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + direction)
      return d.toISOString().split('T')[0]
    })
  }, [])

  const changeMonth = useCallback((direction: number) => {
    setSelectedMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 1 + direction, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  const getWeekDates = useCallback(() => {
    const start = new Date(selectedWeekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [selectedWeekStart])

  const getBookingsForDate = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return bookings.filter((b) => b.booking_date === dateStr)
  }, [bookings])

  const getWorkingWeekDates = useCallback(() => {
    const allDates = getWeekDates()
    if (availability.length === 0) return allDates.filter(d => d.getDay() !== 0 && d.getDay() !== 6)
    const workingDows = availability.filter((a: Availability) => a.is_available).map((a: Availability) => a.day_of_week)
    if (workingDows.length === 0) return allDates.filter(d => d.getDay() !== 0 && d.getDay() !== 6)
    return allDates.filter(d => workingDows.includes(d.getDay()))
  }, [getWeekDates, availability])

  const getCalendarTitle = useCallback(() => {
    if (calendarView === 'day') {
      const d = new Date(selectedDay)
      return d.toLocaleDateString(dateFmtLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (calendarView === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number)
      const d = new Date(y, m - 1, 1)
      return d.toLocaleDateString(dateFmtLocale, { month: 'long', year: 'numeric' })
    }
    // week
    const dates = getWeekDates()
    const start = dates[0]
    const end = dates[6]
    return `${t('proDash.weekOf')} ${start.getDate()} ${t('proDash.to')} ${end.getDate()} ${end.toLocaleDateString(dateFmtLocale, { month: 'long', year: 'numeric' })}`
  }, [calendarView, selectedDay, selectedMonth, getWeekDates, dateFmtLocale, t])

  const navigateCalendar = useCallback((direction: number) => {
    if (calendarView === 'day') changeDay(direction)
    else if (calendarView === 'week') changeWeek(direction)
    else changeMonth(direction)
  }, [calendarView, changeDay, changeWeek, changeMonth])

  const getMonthDays = useCallback(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1)
    const lastDay = new Date(y, m, 0)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6
    const days: Date[] = []
    const start = new Date(firstDay)
    start.setDate(start.getDate() - startDay)
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      days.push(d)
    }
    return { days, firstDay, lastDay }
  }, [selectedMonth])

  return {
    calendarView, setCalendarView,
    selectedDay, setSelectedDay,
    selectedWeekStart,
    selectedMonth,
    getWeekDates, getBookingsForDate,
    getWorkingWeekDates, getCalendarTitle,
    navigateCalendar, getMonthDays,
  }
}
