/**
 * Button component - wrapper around @duro/core Button
 * Maintains backwards compatibility with existing props
 */

import { Button as DuroButton } from '@duro/core'
import type { ButtonVariant } from '@duro/core'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children?: ReactNode
}

const variantMap: Record<string, ButtonVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'ghost',
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <DuroButton
      variant={variantMap[variant]}
      size={size}
      className={className}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </DuroButton>
  )
}
