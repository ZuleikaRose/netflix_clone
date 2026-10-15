import { useState } from 'react'
import { Link } from 'react-router-dom'
import { findPlan } from '../../data/plans.js'
import { discountedPrice, findPromotion, promotions } from '../../data/promotions.js'
import { useAuth } from '../../state/authContext.js'

export function Promotions() {
  const { user, applyPromo, removePromo } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const plan = findPlan(user.plan)
  const active = findPromotion(user.promo)

  const applyCode = (value) => {
    const promo = findPromotion(value)
    if (!promo) return setError('That code isn’t valid. Check the spelling and try again.')
    if (promo.plan && promo.plan !== user.plan) return setError(`${promo.code} only works with the ${findPlan(promo.plan).name} plan.`)
    setError('')
    setCode('')
    applyPromo(promo.code)
  }

  return (
    <div className="settings">
      <section className="settings-card membership" aria-labelledby="promo-plan">
        <h2 id="promo-plan">Your plan</h2>
        <p>
          <b>{plan.name}</b> ·{' '}
          {active
            ? <><span className="sr-only">was </span><s className="muted">{plan.price}</s> <span className="sr-only">now </span><b>{discountedPrice(plan.price, active.percent)}</b>/month</>
            : <>{plan.price}/month</>}
        </p>
        <p className="save-status" role="status">{active && <><span aria-hidden="true">✓</span> {active.code} applied — {active.percent}% off</>}</p>
        {active && <button type="button" className="ghost-cta" onClick={removePromo}>Remove code</button>}
      </section>

      <form className="settings-card" onSubmit={(e) => { e.preventDefault(); applyCode(code) }} noValidate>
        <div className={error ? 'field has-error' : 'field'}>
          <label htmlFor="promo-code">Promo code</label>
          <input id="promo-code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" aria-invalid={Boolean(error)} aria-describedby={error ? 'promo-error' : undefined} placeholder="e.g. WELCOME50" />
          {error && <p id="promo-error" className="field-error" role="alert"><span aria-hidden="true">⚠</span> {error}</p>}
        </div>
        <button type="submit" className="cta" disabled={!code.trim()}>Apply</button>
      </form>

      <h2 className="results-heading flush">Current offers</h2>
      {promotions.map((p) => (
        <section key={p.code} className="settings-card promo-card">
          <div>
            <h3>{p.title}</h3>
            <p className="muted">{p.detail}</p>
            <p className="promo-code"><span className="sr-only">Code: </span>{p.code}</p>
          </div>
          <button type="button" className="ghost-action" disabled={user.promo === p.code} onClick={() => applyCode(p.code)}>
            {user.promo === p.code ? 'Applied' : 'Use code'}
          </button>
        </section>
      ))}
      <p className="muted">Change plans any time in <Link to="/account" className="inline-link">Account</Link>.</p>
    </div>
  )
}
