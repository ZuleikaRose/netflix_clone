import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLibrary } from '../state/libraryContext.js'
import { NewListForm } from './NewListForm.jsx'
import { useT } from '../state/useT.js'

// "Add to a list" on a title page: a checkbox per custom list, and a new list made with this title in it.
// beforeAdd() (TMDB titles) stores the title first and resolves to false if it couldn't.
export function AddToList({ title, beforeAdd }) {
  const t = useT()
  const { lists, toggleInList, addToList } = useLibrary()
  const [error, setError] = useState(null)

  const toggle = async (list) => {
    setError(null)
    if (!list.titleIds.includes(title.id) && beforeAdd && !(await beforeAdd())) {
      setError(t('Couldn’t add {title} to {list}. Please try again.', { title: title.title, list: list.name }))
      return
    }
    toggleInList(list.id, title.id)
  }
  const addToNewList = async (list) => {
    setError(null)
    if (beforeAdd && !(await beforeAdd())) {
      setError(t('Couldn’t add {title} to {list}. Please try again.', { title: title.title, list: list.name }))
      return
    }
    addToList(list.id, title.id)
  }
  const inLists = lists.filter((l) => l.titleIds.includes(title.id)).length

  return (
    <details className="add-to-list">
      <summary>{t('Add to a list')}{inLists > 0 && <span className="muted"> · {t('in {count}', { count: inLists })}</span>}</summary>
      {lists.length > 0 && (
        <fieldset>
          <legend className="sr-only">{t('Lists with {title}', { title: title.title })}</legend>
          {lists.map((l) => (
            <label key={l.id} className="check-row">
              <input type="checkbox" checked={l.titleIds.includes(title.id)} onChange={() => toggle(l)} />
              <span>{l.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      <NewListForm onCreated={addToNewList} />
      {error && <p className="form-alert" role="alert">{error}</p>}
      <p className="muted"><Link to="/lists" className="inline-link">{t('Manage your lists')}</Link></p>
    </details>
  )
}
