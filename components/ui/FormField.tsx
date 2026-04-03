'use client'

import { useId, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  icon?: ReactNode
  className?: string
  labelClassName?: string
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
}

export function FormField({
  label,
  required,
  error,
  hint,
  icon,
  className,
  labelClassName,
  children,
}: FormFieldProps) {
  const reactId = useId()
  const fieldId = `field${reactId}`
  const errorId = error ? `${fieldId}-error` : undefined
  const hintId = hint && !error ? `${fieldId}-hint` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  const child = isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children

  return (
    <div className={className}>
      <label htmlFor={fieldId} className={labelClassName}>
        {icon && <>{icon} </>}
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {child}
      {error && (
        <span id={errorId} role="alert" className="text-red-600 text-xs mt-1 block">
          {error}
        </span>
      )}
      {hint && !error && (
        <span id={hintId} className="text-gray-500 text-xs mt-1 block">
          {hint}
        </span>
      )}
    </div>
  )
}
