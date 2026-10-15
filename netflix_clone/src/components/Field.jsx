import { useId, useState } from 'react'

export function Field({ label, error, type = 'text', hint, ...inputProps }) {
  const id = useId()
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined

  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={id}>{label}</label>
      <div className="field-control">
        <input id={id} type={isPassword && reveal ? 'text' : type} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
        {isPassword && (
          <button type="button" className="reveal" aria-pressed={reveal} onClick={() => setReveal(!reveal)}>
            {reveal ? 'Hide' : 'Show'}<span className="sr-only"> password</span>
          </button>
        )}
      </div>
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error"><span aria-hidden="true">⚠</span> {error}</p>}
    </div>
  )
}
