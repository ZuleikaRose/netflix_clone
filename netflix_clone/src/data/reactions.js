// Thumbs ratings (public.title_reactions). Liked and loved titles seed Because You Liked (loved ones first); titles
// marked Not for me are left out of recommendations.
export const reactionChoices = [
  { value: 'dislike', label: 'Not for me', icon: 'thumbDown' },
  { value: 'like', label: 'I like this', icon: 'thumbUp' },
  { value: 'love', label: 'Love this!', icon: 'thumbsUp' },
]

// Title ids with this reaction, the most recent first
export const reactedWith = (reactions, ...values) => Object.keys(reactions).filter((id) => values.includes(reactions[id])).reverse()

// A filter for recommendation rows: drops the profile's Not for me titles
export const notDisliked = (reactions) => (title) => reactions[title.id] !== 'dislike'
