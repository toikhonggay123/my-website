// School picker for the ClassHub entrance (phase 1, owner decision 12/11/2026): no sign-in, one click.
// The picker page itself is served by CheckIn at /mealcheck/chon-truong on the same edu.afyllx.com origin,
// which shares the cookie. Slugs mirror lib/schools.mjs in the CheckIn app; tests/schools.test.mjs keeps them equal.
// The ?truong= query of the student timetable is ClassHub's own public slug, so it is not read here.

export const SCHOOL_SLUGS = ['na-ri'] as const
const SCHOOL_COOKIE = 'afyllx_truong'
const SCHOOL_STORAGE_KEY = 'afyllx:truong'
const PICKER_PATH = '/mealcheck/chon-truong'

function storedSchool(): string | null {
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === SCHOOL_COOKIE) { try { return decodeURIComponent(rest.join('=')) } catch { return null } }
  }
  try { return localStorage.getItem(SCHOOL_STORAGE_KEY) } catch { return null }
}

/** True when ClassHub may render now; otherwise the browser is already moving to the picker. */
export function ensureSchoolChosen(basePath: string): boolean {
  // Only the web deployment sits behind the shared picker; the local app serves one school.
  if (!basePath || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return true
  const stored = storedSchool()
  if (stored && (SCHOOL_SLUGS as readonly string[]).includes(stored)) return true
  location.replace(PICKER_PATH + '?tiep=' + encodeURIComponent(location.pathname + location.search + location.hash))
  return false
}

export const changeSchoolHref = (basePath: string) =>
  PICKER_PATH + '?tiep=' + encodeURIComponent(basePath || '/classhub')
