import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Field } from '../components/Field.jsx'
import { PageHeader } from '../components/PageHeader.jsx'
import { PosterCard } from '../components/PosterCard.jsx'
import { useCopyToClipboard } from '../components/useCopyToClipboard.js'
import { MAX_LIST_DESCRIPTION, MAX_LIST_NAME, sharePath } from '../data/lists.js'
import { useLibrary } from '../state/libraryContext.js'
import { useCatalog } from '../state/useCatalog.js'
import { focusFirstError } from './formUtils.js'
import { NotFound } from './NotFound.jsx'
import { useT } from '../state/useT.js'

function DetailsForm({ list, updateList }) {
  const t = useT()
  const [form, setForm] = useState({ name: list.name, description: list.description })
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    const formElement = e.currentTarget
    const problem = await updateList(list.id, form)
    setError(problem)
    setStatus(problem ? '' : t('List saved'))
    if (problem) focusFirstError(formElement)
  }
  return (
    <form className="settings-card" onSubmit={submit} noValidate aria-labelledby="list-details-heading">
      <h2 id="list-details-heading">{t('Details')}</h2>
      <Field label={t('Name')} value={form.name} maxLength={MAX_LIST_NAME} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, name: value })) }} error={t(error)} />
      <Field label={t('Description (optional)')} value={form.description} maxLength={MAX_LIST_DESCRIPTION} onChange={(e) => { const { value } = e.target; setForm((f) => ({ ...f, description: value })) }} />
      <button type="submit" className="cta">{t('Save list')}</button>
      <p className="save-status" role="status">{status && <><span aria-hidden="true">✓</span> {status}</>}</p>
    </form>
  )
}

function Sharing({ list, updateList }) {
  const t = useT()
  const { copied, copy } = useCopyToClipboard()
  const [error, setError] = useState(null)
  // The switch moves at once and goes back if saving fails
  const [pending, setPending] = useState(null)
  const isPublic = pending ?? list.isPublic
  const url = `${window.location.origin}${sharePath(list)}`
  const changeSharing = async (value) => {
    setPending(value)
    setError(await updateList(list.id, { isPublic: value }))
    setPending(null)
  }
  return (
    <section className="settings-card" aria-labelledby="sharing-heading">
      <h2 id="sharing-heading">{t('Sharing')}</h2>
      <label className="switch-row">
        <span>
          <span className="switch-label">{t('Share with a link')}</span>
          <span className="muted">{t('Anyone with the link can see this list’s name, description, titles and your profile name, without signing in.')}</span>
        </span>
        <input type="checkbox" role="switch" checked={isPublic} onChange={(e) => changeSharing(e.target.checked)} />
      </label>
      {error && <p className="form-alert" role="alert">{t(error)}</p>}
      {list.isPublic && pending === null && (
        <>
          <Field label={t('Share link')} value={url} readOnly onFocus={(e) => e.target.select()} />
          <button type="button" className="ghost-cta" onClick={() => copy('link', url)}>{t('Copy link')}</button>
          <p className="save-status" role="status">
            {copied?.ok && <><span aria-hidden="true">✓</span> {t('Link copied')}</>}
            {copied && !copied.ok && t('Couldn’t copy: select the link above and copy it yourself.')}
          </p>
        </>
      )}
    </section>
  )
}

// /lists/:listId: one of the profile's lists: its titles, details, sharing, and deleting it
export function ListDetail() {
  const t = useT()
  const { listId } = useParams()
  const navigate = useNavigate()
  const { lists, updateList, deleteList, toggleInList } = useLibrary()
  const { findTitle } = useCatalog()
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const list = lists.find((l) => l.id === listId)
  if (!list) return <NotFound />
  const titles = list.titleIds.map(findTitle).filter(Boolean)

  const remove = async () => {
    const problem = await deleteList(list.id)
    setDeleteError(problem)
    if (!problem) navigate('/lists', { replace: true })
  }

  return (
    <>
      <PageHeader title={list.name} back />
      <div className="settings">
        <section className="settings-card" aria-labelledby="list-titles-heading">
          <h2 id="list-titles-heading">{t('Titles')}</h2>
          {list.description && <p className="muted">{list.description}</p>}
          {titles.length === 0
            ? <p className="muted">{t('Nothing here yet. Use “Add to a list” on any title page.')}</p>
            : (
              <ul className="poster-grid credit-grid list-grid">
                {titles.map((item) => (
                  <li key={item.id}>
                    <PosterCard title={item} />
                    <button type="button" className="ghost-cta list-remove" aria-label={t('Remove {title} from {list}', { title: item.title, list: list.name })} onClick={() => toggleInList(list.id, item.id)}>{t('Remove')}</button>
                  </li>
                ))}
              </ul>
            )}
        </section>
        <DetailsForm key={list.id} list={list} updateList={updateList} />
        <Sharing list={list} updateList={updateList} />
        <section className="settings-card" aria-labelledby="delete-list-heading">
          <h2 id="delete-list-heading">{t('Delete list')}</h2>
          {deleteError && <p className="form-alert" role="alert">{t(deleteError)}</p>}
          {confirming
            ? (
              <div className="confirm-row" role="group" aria-label={t('Delete {name}', { name: list.name })}>
                <p>{t('Delete {name}? Its share link stops working. The titles themselves stay on Netflix Clone.', { name: list.name })}</p>
                <button type="button" className="cta delete-fill" onClick={remove}>{t('Delete list')}</button>
                <button type="button" className="ghost-cta" onClick={() => setConfirming(false)}>{t('Cancel')}</button>
              </div>
            )
            : <button type="button" className="ghost-cta danger" onClick={() => setConfirming(true)}>{t('Delete this list…')}</button>}
        </section>
      </div>
    </>
  )
}
