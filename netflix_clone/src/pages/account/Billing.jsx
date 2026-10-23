import { useState } from 'react'
import { Field } from '../../components/Field.jsx'
import { addMonths, billingSummary, cardBrand, formatDate, nextBillingDate, ordinal, pauseOptions, validateCard } from '../../data/billing.js'
import { useAuth } from '../../state/authContext.js'
import { useT } from '../../state/useT.js'
import { focusFirstError } from '../formUtils.js'

const billingDays = Array.from({ length: 28 }, (_, i) => i + 1)
const blankCard = { name: '', number: '', exp: '', cvc: '' }

function SaveStatus({ message }) {
  return <p className="save-status" role="status">{message && <><span aria-hidden="true">✓</span> {message}</>}</p>
}

function PaymentMethod({ card, onSave }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(blankCard)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')
  const updateField = (key) => (e) => { const { value } = e.target; setForm((f) => ({ ...f, [key]: value })) }

  const submit = (e) => {
    e.preventDefault()
    const next = validateCard(form)
    setErrors(next)
    if (Object.keys(next).length) return focusFirstError(e.currentTarget)
    const digits = form.number.replace(/[\s-]/g, '')
    // Keep only what a payment processor would return to the UI — never the full number or CVC
    onSave({ brand: cardBrand(digits), last4: digits.slice(-4), exp: form.exp.replace(/\s/g, '') })
    setForm(blankCard)
    setEditing(false)
    setStatus(t('Payment method updated'))
  }

  return (
    <div className="billing-block">
      <h3>{t('Payment method')}</h3>
      <p className="card-on-file"><b>{card.brand} •••• {card.last4}</b> <span className="muted">{t('expires {date}', { date: card.exp })}</span></p>
      {!editing && <button type="button" className="ghost-cta" onClick={() => { setEditing(true); setStatus('') }}>{t('Update payment method')}</button>}
      {editing && (
        <form className="card-form" onSubmit={submit} noValidate aria-label={t('New payment method')}>
          <Field label={t('Name on card')} autoComplete="cc-name" value={form.name} onChange={updateField('name')} error={errors.name} />
          <Field label={t('Card number')} autoComplete="cc-number" inputMode="numeric" value={form.number} onChange={updateField('number')} error={errors.number} hint={t('Test card: {number}', { number: '4242 4242 4242 4242' })} />
          <div className="field-pair">
            <Field label={t('Expiry (MM/YY)')} autoComplete="cc-exp" inputMode="numeric" value={form.exp} onChange={updateField('exp')} error={errors.exp} />
            <Field label={t('Security code')} autoComplete="cc-csc" inputMode="numeric" value={form.cvc} onChange={updateField('cvc')} error={errors.cvc} />
          </div>
          <button type="submit" className="cta">{t('Save card')}</button>
          <button type="button" className="ghost-cta" onClick={() => { setEditing(false); setForm(blankCard); setErrors({}) }}>{t('Cancel')}</button>
        </form>
      )}
      <SaveStatus message={status} />
    </div>
  )
}

export function Billing() {
  const { user, updateBilling } = useAuth()
  const { billing } = user
  const t = useT()
  const [months, setMonths] = useState(pauseOptions[0])
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [status, setStatus] = useState('')

  const changeDay = (day) => {
    updateBilling({ day })
    setStatus(t('Billing date changed to the {day}. Next payment {date}.', { day: ordinal(day), date: formatDate(nextBillingDate(day)) }))
  }

  const pause = () => {
    const resumesOn = addMonths(nextBillingDate(billing.day), months).toISOString()
    updateBilling({ status: 'paused', resumesOn })
    setStatus(months > 1 ? t('Membership paused for {count} months.', { count: months }) : t('Membership paused for {count} month.', { count: months }))
  }

  const cancel = () => {
    updateBilling({ status: 'cancelled', endsOn: nextBillingDate(billing.day).toISOString() })
    setConfirmingCancel(false)
    setStatus(t('Membership cancelled. You won’t be charged again.'))
  }

  // message: 'Membership resumed. Next payment {date}.' or 'Membership restarted. …', already translated
  const reactivate = (message) => {
    updateBilling({ status: 'active', resumesOn: null, endsOn: null })
    setStatus(message)
  }

  return (
    <section className="settings-card" aria-labelledby="billing-heading">
      <h2 id="billing-heading" tabIndex={-1}>{t('Billing')}</h2>
      <p className={`billing-state ${billing.status}`}>{billingSummary(billing)}</p>

      <PaymentMethod card={billing.card} onSave={(card) => updateBilling({ card })} />

      <div className="billing-block">
        <h3>{t('Billing date')}</h3>
        <label className="select-row">
          <span className="switch-label">{t('Bill me on the')}</span>
          <select value={billing.day} onChange={(e) => changeDay(Number(e.target.value))} disabled={billing.status !== 'active'}>
            {billingDays.map((d) => <option key={d} value={d}>{t('{day} of each month', { day: ordinal(d) })}</option>)}
          </select>
        </label>
      </div>

      {billing.status === 'active' && (
        <div className="billing-block">
          <h3>{t('Pause membership')}</h3>
          <p className="muted">{t('Take a break without losing your profile. Billing stops until you come back.')}</p>
          <label className="select-row">
            <span className="switch-label">{t('Pause for')}</span>
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {pauseOptions.map((m) => <option key={m} value={m}>{m > 1 ? t('{count} months', { count: m }) : t('{count} month', { count: m })}</option>)}
            </select>
          </label>
          <button type="button" className="ghost-cta" onClick={pause}>{t('Pause membership')}</button>
        </div>
      )}
      {billing.status === 'paused' && <button type="button" className="cta" onClick={() => reactivate(t('Membership resumed. Next payment {date}.', { date: formatDate(nextBillingDate(billing.day)) }))}>{t('Resume now')}</button>}

      {billing.status === 'active' && (
        <div className="billing-block">
          <h3>{t('Cancel membership')}</h3>
          {!confirmingCancel
            ? <button type="button" className="ghost-cta danger" onClick={() => setConfirmingCancel(true)}>{t('Cancel membership')}</button>
            : (
              <div className="confirm-box" role="group" aria-labelledby="cancel-confirm">
                <p id="cancel-confirm">{t('Cancel your membership? You can keep watching until')} <b>{formatDate(nextBillingDate(billing.day))}</b>{t(', and you won’t be charged again.')}</p>
                <button type="button" className="cta danger-fill" onClick={cancel}>{t('Yes, cancel membership')}</button>
                <button type="button" className="ghost-cta" onClick={() => setConfirmingCancel(false)} autoFocus>{t('Keep membership')}</button>
              </div>
            )}
        </div>
      )}
      {billing.status === 'cancelled' && <button type="button" className="cta" onClick={() => reactivate(t('Membership restarted. Next payment {date}.', { date: formatDate(nextBillingDate(billing.day)) }))}>{t('Restart membership')}</button>}

      <SaveStatus message={status} />
    </section>
  )
}
