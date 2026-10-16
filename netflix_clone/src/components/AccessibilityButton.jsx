import { useAccessibility } from '../state/accessibilityContext.js'
import { Icon } from './Icon.jsx'

// Opens the accessibility menu; shown in every page header so it's always in the same place
export function AccessibilityButton() {
  const { menuOpen, openMenu } = useAccessibility()
  return (
    <button type="button" className="icon-button" aria-label="Accessibility menu" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={openMenu}>
      <Icon name="accessibility" />
    </button>
  )
}
