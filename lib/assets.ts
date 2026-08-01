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

export interface HeroMedia {
  type: 'video' | 'image'
  src: string
  poster?: string
}

export function getHeroMedia(): HeroMedia | null {
  for (const file of ['hero.mp4', 'hero.webm']) {
    if (exists(file)) {
      return {
        type: 'video',
        src: `/${file}`,
        poster: exists('hero-poster.jpg') ? '/hero-poster.jpg' : undefined,
      }
    }
  }
  for (const file of ['hero.avif', 'hero.webp', 'hero.jpg', 'hero.jpeg', 'hero.png']) {
    if (exists(file)) {
      return { type: 'image', src: `/${file}` }
    }
  }
  return null
}
