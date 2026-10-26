// Dataset garments are addressed by their folder, which is also the image folder
// (/img/clothing/<folder>/...). The 3D fitting room and the outfit tags use the same key.
export const tryOnSlot = { 'm-tshirts': 'top', 'm-shirts': 'top', 'm-trousers': 'bottom', 'w-skirts': 'bottom' }

export const folderOf = image => /\/img\/clothing\/([^/]+)\//.exec(image || '')?.[1] || null

export function tryOnLink(category, image) {
  const slot = tryOnSlot[category]
  const folder = folderOf(image)
  return slot && folder ? `/try-on?${slot}=${encodeURIComponent(folder)}` : null
}

export function outfitLink(top, bottom) {
  return `/try-on?top=${encodeURIComponent(top)}&bottom=${encodeURIComponent(bottom)}`
}
