import fs from 'fs'
import path from 'path'

/**
 * Build-time/server-side asset detection.
 *
 * Place the official assets in /public:
 *   - /public/logo.svg   (official Jarbou Logistik logo)
 *   - /public/hero.mp4 or /public/hero.webm (hero video, optional)
 *   - /public/hero.jpg / /public/hero.webp / /public/hero.avif (hero image)
 *   - /public/hero-poster.jpg (poster shown while a hero video loads)
 *
 * As soon as the files exist, the site uses them automatically — no code
 * changes needed. Until then, tasteful built-in fallbacks are shown and
 * a missing-image icon can never appear.
 */

const publicDir = path.join(process.cwd(), 'public')

function exists(file: string): boolean {
  try {
    return fs.existsSync(path.join(publicDir, file))
  } catch {
    return false
  }
}

export function hasOfficialLogo(): boolean {
  return exists('logo.svg') || exists('logo.png')
}

export function officialLogoSrc(): string {
  return exists('logo.svg') ? '/logo.svg' : '/logo.png'
}

/**
 * Logo variant for dark surfaces (header/footer). Prefers logo-white.svg,
 * falls back to the standard logo.
 */
export function officialLogoDarkSurfaceSrc(): string | null {
  if (exists('logo-white.svg')) return '/logo-white.svg'
  if (exists('logo-white.png')) return '/logo-white.png'
  if (hasOfficialLogo()) return officialLogoSrc()
  return null
}

export interface HeroMedia {
  type: 'video' | 'image'
  src: string
  poster?: string
}

export function getHeroMedia(): HeroMedia | null {
  const videoCandidates = ['jarbou-hero.mp4', 'jarbou-hero.webm', 'hero.mp4', 'hero.webm']
  const posterCandidates = ['jarbou-hero-poster.jpg', 'hero-poster.jpg']
  const imageCandidates = [
    'jarbou-hero.avif', 'jarbou-hero.webp', 'jarbou-hero.jpg', 'jarbou-hero.jpeg', 'jarbou-hero.png',
    'hero.avif', 'hero.webp', 'hero.jpg', 'hero.jpeg', 'hero.png',
  ]

  for (const file of videoCandidates) {
    if (exists(file)) {
      const poster = posterCandidates.find(p => exists(p))
      return {
        type: 'video',
        src: `/${file}`,
        poster: poster ? `/${poster}` : undefined,
      }
    }
  }
  for (const file of imageCandidates) {
    if (exists(file)) {
      return { type: 'image', src: `/${file}` }
    }
  }
  return null
}
