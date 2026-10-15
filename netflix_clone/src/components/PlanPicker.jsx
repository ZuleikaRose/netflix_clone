import { plans } from '../data/plans.js'

export function PlanPicker({ value, onChange, name = 'plan' }) {
  return (
    <fieldset className="plan-picker">
      <legend>Choose your plan</legend>
      {plans.map((p) => (
        <label key={p.id} className={value === p.id ? 'plan-card selected' : 'plan-card'}>
          <input type="radio" name={name} value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} />
          <span className="plan-name">{p.name}</span>
          <span className="plan-price">{p.price}<small>/mo</small></span>
          <span className="plan-detail">{p.quality} · {p.screens} screen{p.screens > 1 ? 's' : ''}</span>
        </label>
      ))}
    </fieldset>
  )
}
