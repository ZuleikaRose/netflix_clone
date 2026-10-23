import { useState } from 'react'
import { Link } from 'react-router-dom'
import { findPlan } from '../../data/plans.js'
import { discountedPrice, findPromotion, promotions } from '../../data/promotions.js'
import { useAuth } from '../../state/authContext.js'
import { useT } from '../../state/useT.js'

// "WELCOME50 only works with the Premium plan." (from apply-promo or the in-memory check) → its parts, so it can be
// translated with vars
const planOnly = /^(\S+) only works with the (.+) plan\.$/

export function Promotions() {
  const t = useT()
  const { user, applyPromo, removePromo } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const plan = findPlan(user.plan)
  const active = findPromotion(user.promo)
  const onlyFor = planOnly.exec(error)
  const errorText = onlyFor ? t('{code} only works with the {plan} plan.', { code: onlyFor[1], plan: t(onlyFor[2]) }) : t(error)

  // The auth backend checks the code (with Supabase, the apply-promo Edge Function does)
  const applyCode = async (value) => {
    const failure = await applyPromo(value)
    setError(failure ?? '')
    if (!failure) setCode('')
  }

  return (
    <div className="settings">
      <section className="settings-card membership" aria-labelledby="promo-plan">
        <h2 id="promo-plan">{t('Your plan')}</h2>
        <p>
          <b>{t(plan.name)}</b> ·{' '}
          {active
            ? <><span className="sr-only">{t('was')} </span><s className="muted">{plan.price}</s> <span className="sr-only">{t('now')} </span><b>{discountedPrice(plan.price, active.percent)}</b>{t('/month')}</>
            : <>{plan.price}{t('/month')}</>}
        </p>
        <p className="save-status" role="status">{active && <><span aria-hidden="true">✓</span> {t('{code} applied — {percent}% off', { code: active.code, percent: active.percent })}</>}</p>
        {active && <button type="button" className="ghost-cta" onClick={removePromo}>{t('Remove code')}</button>}
      </section>

      <form className="settings-card" onSubmit={(e) => { e.preventDefault(); applyCode(code) }} noValidate>
        <div className={error ? 'field has-error' : 'field'}>
          <label htmlFor="promo-code">{t('Promo code')}</label>
          <input id="promo-code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" aria-invalid={Boolean(error)} aria-describedby={error ? 'promo-error' : undefined} placeholder={t('e.g. WELCOME50')} />
          {error && <p id="promo-error" className="field-error" role="alert"><span aria-hidden="true">⚠</span> {errorText}</p>}
        </div>
        <button type="submit" className="cta" disabled={!code.trim()}>{t('Apply')}</button>
      </form>

      <h2 className="results-heading flush">{t('Current offers')}</h2>
      {promotions.map((p) => (
        <section key={p.code} className="settings-card promo-card">
          <div>
            <h3>{t(p.title)}</h3>
            <p className="muted">{t(p.detail)}</p>
            <p className="promo-code"><span className="sr-only">{t('Code:')} </span>{p.code}</p>
          </div>
          <button type="button" className="ghost-action" disabled={user.promo === p.code} onClick={() => applyCode(p.code)}>
            {user.promo === p.code ? t('Applied') : t('Use code')}
          </button>
        </section>
      ))}
      <p className="muted">{t('Change plans any time in')} <Link to="/account" className="inline-link">{t('Account')}</Link>.</p>
    </div>
  )
}
