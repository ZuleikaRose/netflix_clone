import { Icon } from './Icon.jsx'
import { usePreview } from './usePreview.js'

// Artwork and play/pause toggle for a title preview; state comes from usePreview
export function PreviewArt({ title, preview }) {
  return <img src={title.image} alt="" className={preview.playing ? 'preview-art previewing' : 'preview-art'} style={{ filter: title.tint }} />
}

export function PreviewToggle({ title, preview, className = '' }) {
  if (!preview.motionAllowed) return null
  return (
    <button type="button" className={`preview-toggle ${className}`} aria-label={`${preview.playing ? 'Pause' : 'Play'} preview of ${title.title}`} onClick={preview.toggle}>
      <Icon name={preview.playing ? 'pause' : 'play'} /><span aria-hidden="true">Preview</span>
    </button>
  )
}

// Artwork with its toggle in the corner (title pages)
export function Preview({ title }) {
  const preview = usePreview(title)
  return <><PreviewArt title={title} preview={preview} /><PreviewToggle title={title} preview={preview} className="corner" /></>
}
