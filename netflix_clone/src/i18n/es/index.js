import browse from './browse.js'
import common from './common.js'
import content from './content.js'
import info from './info.js'
import player from './player.js'
import shell from './shell.js'

// Spanish (Latin American, informal "tú"), keyed by the English text. One file per area of the app; words used
// everywhere live in common.js, and the built-in catalog's synopses and episode names in content.js. scripts/i18n-check.mjs reports a key given two different translations.
export default { ...common, ...shell, ...browse, ...player, ...info, ...content }
