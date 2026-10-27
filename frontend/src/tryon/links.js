// Dataset garments are addressed by their folder, which is also the image folder
// (/img/clothing/<folder>/...). The 3D fitting room and the outfit tags use the same key.
// Shirts are left out for now: their button placket and collar mesh do not look right yet.
export const tryOnSlot = { 'm-tshirts': 'top', 'w-tshirts': 'top', 'm-shirts': 'top', 'm-trousers': 'bottom', 'w-trousers': 'bottom', 'w-skirts': 'bottom' }

// Dataset T-shirts and shirts are unisex; the shop lists them under men and women.
export const UNISEX_CATEGORIES = ['m-tshirts', 'm-shirts']

export const folderOf = image => /\/img\/clothing\/([^/]+)\//.exec(image || '')?.[1] || null

export function tryOnLink(category, image) {
  const slot = tryOnSlot[category]
  const folder = folderOf(image)
  return slot && folder ? `/try-on?${slot}=${encodeURIComponent(folder)}` : null
}

export function outfitLink(top, bottom) {
  return `/try-on?top=${encodeURIComponent(top)}&bottom=${encodeURIComponent(bottom)}`
}
