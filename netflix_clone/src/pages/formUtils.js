// After a failed submit, move keyboard and screen-reader focus to the first invalid field
export function focusFirstError(form) {
  requestAnimationFrame(() => form.querySelector('[aria-invalid="true"]')?.focus())
}
