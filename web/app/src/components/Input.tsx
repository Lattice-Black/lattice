import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-text-secondary text-sm font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 bg-background border border-border rounded text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors ${className}`}
          {...props}
        />
        {error && <p className="text-status-down text-xs">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-text-secondary text-sm font-medium">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full px-3 py-2 bg-background border border-border rounded text-text-primary focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-status-down text-xs">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-text-secondary text-sm font-medium">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={`w-full px-3 py-2 bg-background border border-border rounded text-text-primary placeholder-text-secondary/50 focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors resize-y min-h-[100px] ${className}`}
          {...props}
        />
        {error && <p className="text-status-down text-xs">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
