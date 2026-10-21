import { useState } from 'react'
import { focusFirstError } from '../pages/formUtils.js'
import { MAX_LIST_NAME } from '../data/lists.js'
import { useLibrary } from '../state/libraryContext.js'
import { Field } from './Field.jsx'

// Creates a list; onCreated(list) runs once it exists (e.g. to add the current title to it)
export function NewListForm({ onCreated, label = 'New list name' }) {
  const { createList } = useLibrary()
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const { list, error: problem } = await createList(name)
    setError(problem ?? null)
    if (problem) {
      focusFirstError(form)
      return
    }
    setName('')
    onCreated?.(list)
  }

  return (
    <form className="new-list-form" onSubmit={submit} noValidate>
      <Field label={label} value={name} maxLength={MAX_LIST_NAME} onChange={(e) => setName(e.target.value)} error={error} />
      <button type="submit" className="cta">Create list</button>
    </form>
  )
}
