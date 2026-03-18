'use client'

import LocaleLink from '@/components/common/LocaleLink'

type ButtonVariant = 'primary' | 'ghost' | 'outline'
type ButtonSize = 'default' | 'lg'

interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  href?: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-yellow text-dark font-display font-bold rounded-full hover:bg-yellow-light hover:-translate-y-0.5 transition-all shadow-[0_6px_20px_rgba(255,214,0,0.3)]',
  ghost:
    'border-[1.5px] border-dark text-dark rounded-full font-medium bg-transparent hover:bg-dark hover:text-white transition-all',
  outline:
    'border-[1.5px] border-dark text-dark rounded-full font-semibold bg-transparent hover:bg-dark hover:text-white transition-all inline-flex items-center gap-2',
}

const sizeStyles: Record<ButtonSize, string> = {
  default: 'px-5 py-2.5 text-[0.88rem]',
  lg: 'px-8 py-3.5 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'default',
  href,
  children,
  className = '',
  onClick,
  type = 'button',
  disabled = false,
}: ButtonProps) {
  const classes = `${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim()

  if (href) {
    return (
      <LocaleLink href={href} className={`inline-block text-center no-underline ${classes}`}>
        {children}
      </LocaleLink>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer ${classes}`}
    >
      {children}
    </button>
  )
}
