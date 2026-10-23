import { useAccessibility } from '../state/accessibilityContext.js'
import { useT } from '../state/useT.js'
import { Icon } from './Icon.jsx'

// Opens the accessibility menu; shown in every page header so it's always in the same place
export function AccessibilityButton() {
  const { menuOpen, openMenu } = useAccessibility()
  const t = useT()
  return (
    <button type="button" className="icon-button" aria-label={t('Accessibility menu')} aria-haspopup="dialog" aria-expanded={menuOpen} onClick={openMenu}>
      <Icon name="accessibility" />
    </button>
  )
}
