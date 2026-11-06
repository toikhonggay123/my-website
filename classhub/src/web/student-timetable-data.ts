import { z } from 'zod'
import published from './published-timetable.json' with { type: 'json' }

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
const date = z.iso.date()
const period = z.strictObject({
  date, number: z.number().int().min(1).max(30), shift: z.enum(['morning', 'afternoon', 'evening']),
  start: clock, end: clock, subject: z.string().trim().min(1).max(80), room: z.string().trim().max(60),
})
const timetable = z.strictObject({
  school: z.string().trim().min(1).max(120),
  classes: z.array(z.strictObject({
    id: z.string().regex(/^[a-z0-9-]{1,30}$/), grade: z.number().int().min(1).max(12),
    name: z.string().trim().min(1).max(32), weeks: z.array(date), periods: z.array(period),
  })).min(1),
}).superRefine(({ classes }, context) => {
  const classIds = new Set<string>()
  for (const [index, item] of classes.entries()) {
    const issue = (message: string) => context.addIssue({ code: 'custom', path: ['classes', index], message })
    if (classIds.has(item.id)) issue('Mã lớp bị trùng: ' + item.id)
    classIds.add(item.id)
    const weeks = new Set(item.weeks)
    if (weeks.size !== item.weeks.length || item.weeks.some(day => weekStart(day) !== day)) {
      issue('Danh sách tuần phải gồm các ngày thứ Hai khác nhau.')
    }
    const slots = new Set<string>()
    let last: Period | undefined
    const ordered = [...item.periods].sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    for (const row of ordered) {
      const key = [row.date, row.shift, row.number].join('/')
      if (slots.has(key) || row.end <= row.start || (last?.date === row.date && last.end > row.start)) {
        issue('Trùng tiết, giao giờ hoặc giờ kết thúc sai: ' + key)
      }
      if (!weeks.has(weekStart(row.date))) issue('Tiết chưa thuộc tuần đã công bố: ' + row.date)
      slots.add(key)
      last = row
    }
  }
})

export type Period = z.infer<typeof period>
export type StudentClass = z.infer<typeof timetable>['classes'][number]
export const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
export const shifts = { morning: 'Buổi sáng', afternoon: 'Buổi chiều', evening: 'Buổi tối' } as const
export const moveDate = (day: string, offset: number) => new Date(Date.parse(day) + offset * 86_400_000).toISOString().slice(0, 10)
export const weekStart = (day: string) => moveDate(day, 1 - (new Date(day).getUTCDay() || 7))

const official = published === null ? null : timetable.parse(published)
const sampleClasses: StudentClass[] = [6, 7, 8, 9].flatMap(grade => ['A', 'B'].map(group => ({
  grade, id: grade + group.toLowerCase(), name: grade + group, weeks: [], periods: [],
})))
const classOrder = new Intl.Collator('vi', { numeric: true })
export const studentTimetable = {
  sample: official === null,
  school: official?.school ?? 'Lịch minh họa',
  classes: [...(official?.classes ?? sampleClasses)].sort((a, b) => a.grade - b.grade || classOrder.compare(a.name, b.name)),
}

const subjects = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Khoa học tự nhiên', 'Lịch sử và Địa lý', 'Tin học', 'Công nghệ', 'Giáo dục thể chất']
const morning = [['07:00', '07:45'], ['07:50', '08:35'], ['08:55', '09:40'], ['09:45', '10:30'], ['10:35', '11:20']]
const afternoon = [['14:00', '14:45'], ['14:50', '15:35']]

export function periodsForWeek(item: StudentClass, monday: string): Period[] | null {
  if (official) return item.weeks.includes(monday)
    ? item.periods.filter(row => row.date >= monday && row.date <= moveDate(monday, 6))
    : null

  const offset = sampleClasses.indexOf(item)
  return Array.from({ length: 5 }, (_, day) => {
    const rows = day === 2 ? morning : [...morning, ...afternoon]
    return rows.map(([start, end], index): Period => {
      const subject = subjects[(offset + day * 3 + index) % subjects.length]
      return {
        date: moveDate(monday, day), number: index + 1, shift: index < morning.length ? 'morning' : 'afternoon',
        start, end, subject, room: subject === 'Tin học' ? 'Phòng Tin học' : 'Phòng ' + item.name,
      }
    })
  }).flat()
}
