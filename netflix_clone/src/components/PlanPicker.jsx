import { plans } from '../data/plans.js'
import { useT } from '../state/useT.js'

export function PlanPicker({ value, onChange, name = 'plan' }) {
  const t = useT()
  return (
    <fieldset className="plan-picker">
      <legend>{t('Choose your plan')}</legend>
      {plans.map((p) => (
        <label key={p.id} className={value === p.id ? 'plan-card selected' : 'plan-card'}>
          <input type="radio" name={name} value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} />
          <span className="plan-name">{t(p.name)}</span>
          <span className="plan-price">{p.price}<small>{t('/mo')}</small></span>
          <span className="plan-detail">{p.quality} · {p.screens > 1 ? t('{count} screens', { count: p.screens }) : t('{count} screen', { count: p.screens })}</span>
        </label>
      ))}
    </fieldset>
  )
}
