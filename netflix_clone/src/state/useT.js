import { useCallback } from 'react'
import { translate } from '../i18n/index.js'
import { useAccessibility } from './accessibilityContext.js'

// t(englishText, vars): the text in the interface language (the accessibility menu's Language). A component that
// calls this re-renders when the language changes. Pass changing parts as vars, never in the text itself:
// t('Donate {amount}', { amount }).
export function useT() {
  const language = useAccessibility()?.settings.language ?? 'en'
  return useCallback((text, vars) => translate(language, text, vars), [language])
}
