/**
 * Input component - wrapper around @duro/core Input
 * Maintains backwards compatibility with existing props (label, error message)
 */

import { Input as DuroInput, Label, Text } from '@duro/core'
import type { InputHTMLAttributes } from 'react'
import { forwardRef } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className = '', id, ...props }, ref) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <Label htmlFor={inputId}>
            {label}
          </Label>
        )}
        <DuroInput
          ref={ref}
          id={inputId}
          error={!!error}
          fullWidth
          className={className}
          {...props}
        />
        {error && (
          <Text size="xs" className="text-red-500">
            {error}
          </Text>
        )}
      </div>
    )
  }
)
