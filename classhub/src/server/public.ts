import { z } from 'zod'
import { type Ctx, dayMs, isoDate, one, result, router, rows, today, validated } from './core'
import { edgeCache, edgeCached } from './edge'

// Public student timetable. Only schools whose owner chose a public slug are served. The response holds
// class names, subjects, period times, rooms and notices. It never includes teachers, students or attendance.

export const publicSlug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/)
type Shift = 'morning' | 'afternoon'
type PublicPeriod = { date: string; shift: Shift; number: number; subject: string; start: string; end: string; room: string; cancelled: boolean }
const shiftName: Record<Shift, string> = { morning: 'Buổi sáng', afternoon: 'Buổi chiều' }
const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay() || 7
const short = (date: string) => date.slice(8, 10) + '/' + date.slice(5, 7)
/** Stable, readable class key for links such as ?lop=8a. */
export const classKey = (name: string) => name.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/^lop\s*/, '').replace(/[^a-z0-9]/g, '') || 'lop'

async function school(c: Ctx) {
  const requested = c.req.query('truong')
  if (requested) {
    const slug = validated(publicSlug, requested.toLowerCase())
    return one<{ id: string; name: string; public_slug: string }>(c, `SELECT id,name,public_slug FROM organizations
      WHERE public_slug=? AND status='active' AND type='school'`, slug)
  }
  // Without a slug the page serves the only public school, if there is exactly one.
  const list = await rows<{ id: string; name: string; public_slug: string }>(c, `SELECT id,name,public_slug FROM organizations
    WHERE public_slug IS NOT NULL AND status='active' AND type='school' LIMIT 2`)
  return list.length === 1 ? list[0] : null
}

/** Background work after the response; skipped where there is no execution context (Node tests). */
function waitUntil(c: Ctx, task: Promise<unknown>) {
  let context: ExecutionContext | undefined
  try { context = c.executionCtx } catch { context = undefined }
  context?.waitUntil(task)
}
/** The address the browser asked for: the Edu gateway removes /classhub before forwarding. */
function publicUrl(c: Ctx) {
  const url = new URL(c.req.url)
  url.pathname = (c.env.APP_BASE_PATH ?? '') + url.pathname
  return url.href
}

export const publicRoutes = router()
  // Every student opens this page and it changes rarely: on edu.afyllx.com the edge keeps each URL for 60 s (its
  // Cache-Control) instead of running the timetable queries on every hit. Publishing changes or stopping
  // publication can take up to a minute to show there. Local runs and QA never cache.
  .get('/public/timetable', c => edgeCached(publicUrl(c), task => waitUntil(c, task), async () => {
    const org = await school(c)
    c.header('Cache-Control', 'public, max-age=60')
    if (!org) return result(c, { enabled: false })
    const date = today()
    const anchor = validated(isoDate, c.req.query('tuan') ?? date)
    const monday = addDays(anchor, 1 - weekdayOf(anchor))
    const sunday = addDays(monday, 6)
    const [classRows, versions, bells] = await Promise.all([
      rows<{ id: string; name: string; grade: string | null }>(c, `SELECT cl.id,cl.name,d.grade FROM classes cl
        LEFT JOIN directory_classes d ON d.org_id=cl.org_id AND d.class_id=cl.id
        WHERE cl.org_id=? AND cl.status IN ('scheduled','active') AND EXISTS (SELECT 1 FROM timetable_slots s
          JOIN timetable_versions v ON v.org_id=s.org_id AND v.id=s.version_id WHERE s.org_id=cl.org_id AND s.class_id=cl.id AND v.status='published')
        ORDER BY cl.name,cl.id LIMIT 200`, org.id),
      rows<{ id: string; term_id: string; effective_from: string; starts_on: string; ends_on: string }>(c, `SELECT v.id,v.term_id,v.effective_from,
        t.starts_on,t.ends_on FROM timetable_versions v JOIN school_terms t ON t.org_id=v.org_id AND t.id=v.term_id
        WHERE v.org_id=? AND v.status='published' ORDER BY v.effective_from DESC`, org.id),
      rows<{ shift: Shift; period: number; starts_at: string; ends_at: string }>(c,
        'SELECT shift,period,starts_at,ends_at FROM bell_periods WHERE org_id=?', org.id),
    ])
    const used = new Set<string>()
    const classes = classRows.map(row => {
      let key = classKey(row.name)
      if (used.has(key)) key += '-' + row.id.slice(0, 4)
      used.add(key)
      const grade = Number(row.grade ?? row.name.match(/\d+/)?.[0] ?? 0) || 0
      return { id: key, name: row.name, grade, internal: row.id }
    })
    const requested = c.req.query('lop')?.trim().toLowerCase()
    const item = requested ? classes.find(row => row.id === requested) : undefined
    const versionOn = (day: string) => versions.find(row => row.starts_on <= day && day <= row.ends_on && row.effective_from <= day)
    const notices: { date: string; text: string }[] = []
    const closures = await rows<{ closed_on: string; reason: string }>(c, `SELECT closed_on,reason FROM school_closures
      WHERE org_id=? AND closed_on BETWEEN ? AND ? ORDER BY closed_on`, org.id, monday, sunday)
    for (const row of closures) notices.push({ date: row.closed_on, text: dayNames[weekdayOf(row.closed_on) - 1] + ' ' + short(row.closed_on) + ': nghỉ học · ' + row.reason })
    for (const row of versions.filter(version => version.effective_from > monday && version.effective_from <= addDays(sunday, 7))) {
      notices.push({ date: row.effective_from, text: 'Thời khóa biểu mới áp dụng từ ' + dayNames[weekdayOf(row.effective_from) - 1] + ' ' + short(row.effective_from) + '.' })
    }
    let timetable: null | { id: string; name: string; grade: number; published: boolean; periods: PublicPeriod[] } = null
    if (item) {
      const [slots, cancelled] = await Promise.all([
        rows<{ version_id: string; weekday: number; shift: Shift; period: number; subject: string; room: string }>(c,
          `SELECT s.version_id,s.weekday,s.shift,s.period,sub.name AS subject,s.room FROM timetable_slots s
          JOIN subjects sub ON sub.org_id=s.org_id AND sub.id=s.subject_id
          WHERE s.org_id=? AND s.class_id=? AND s.version_id IN (SELECT id FROM timetable_versions WHERE org_id=? AND status='published')`,
        org.id, item.internal, org.id),
        rows<{ lesson_date: string; shift: Shift }>(c, `SELECT lesson_date,shift FROM class_sessions WHERE org_id=? AND class_id=?
          AND shift IS NOT NULL AND status='cancelled' AND lesson_date BETWEEN ? AND ?`, org.id, item.internal, monday, sunday),
      ])
      const closed = new Set(closures.map(row => row.closed_on))
      const off = new Set(cancelled.map(row => row.lesson_date + ':' + row.shift))
      const bell = new Map(bells.map(row => [row.shift + ':' + row.period, row]))
      const periods: PublicPeriod[] = []
      let published = false
      for (let index = 0; index < 7; index++) {
        const day = addDays(monday, index)
        const version = versionOn(day)
        if (!version) continue
        published = true
        if (closed.has(day)) continue
        const daySlots = slots.filter(slot => slot.version_id === version.id && slot.weekday === index + 1)
        for (const slot of daySlots) {
          const time = bell.get(slot.shift + ':' + slot.period)
          periods.push({ date: day, shift: slot.shift, number: slot.period, subject: slot.subject, room: slot.room,
            start: time?.starts_at ?? '', end: time?.ends_at ?? '', cancelled: off.has(day + ':' + slot.shift) })
        }
        for (const shift of ['morning', 'afternoon'] as const) {
          if (off.has(day + ':' + shift) && daySlots.some(slot => slot.shift === shift)) {
            notices.push({ date: day, text: shiftName[shift] + ' ' + dayNames[index] + ' ' + short(day) + ': lớp ' + item.name + ' nghỉ.' })
          }
        }
      }
      timetable = { id: item.id, name: item.name, grade: item.grade, published, periods }
    }
    notices.sort((a, b) => a.date.localeCompare(b.date))
    return result(c, {
      enabled: true, school: org.name, slug: org.public_slug, today: date, monday, notices,
      classes: classes.map(({ internal: _internal, ...row }) => row), timetable,
    })
  }, c.env.PUBLIC_EDGE_CACHE === '1' ? edgeCache() : undefined))
