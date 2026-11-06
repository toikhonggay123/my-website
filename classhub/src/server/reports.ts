import { z } from 'zod'
import {
  type Ctx, audit, bad, classScope, dayMs, isoDate, newId, now, requireRole, result, router, rows, scopedClass, today, uuid, validated,
} from './core'

// Aggregated attendance reports for administrators: the monthly register of one class, a per-class and
// per-student summary over a range (a school term, for example) and the list of students to follow up.
// Only finalized sessions count. Codes follow the paper register: blank present, M late, P excused, K absent.

type Status = 'present' | 'late' | 'absent' | 'excused' | 'unmarked'
type Totals = { present: number; late: number; absent: number; excused: number }
/** A student needs follow-up from 3 unexcused absences, 5 absences in total or 5 late arrivals in the range. */
export const alertRule = { absent: 3, missed: 5, late: 5 }
export const flagged = (row: Totals) => row.absent >= alertRule.absent || row.absent + row.excused >= alertRule.missed || row.late >= alertRule.late
const codes: Record<Status, string> = { present: '', late: 'M', excused: 'P', absent: 'K', unmarked: '' }
const admins = (c: Ctx) => requireRole(c, 'owner', 'branch_admin')
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * dayMs).toISOString().slice(0, 10)
const rate = (row: Totals) => {
  const counted = row.present + row.late + row.absent
  return counted ? (row.present + row.late) / counted : null
}

function csv(lines: (string | number)[][]) {
  const cell = (raw: string | number) => {
    const value = String(raw)
    const safe = /^[\s﻿]*[=+\-@＝＋－＠]|^[\t\r\n]/.test(value) ? "'" + value : value
    return '"' + safe.replaceAll('"', '""') + '"'
  }
  return '﻿' + lines.map(line => line.map(cell).join(',')).join('\r\n')
}
function download(c: Ctx, name: string, body: string) {
  return c.body(body, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${name}"`,
  })
}

function range(c: Ctx) {
  const to = validated(isoDate, c.req.query('to') ?? today())
  const from = validated(isoDate, c.req.query('from') ?? addDays(to, -29))
  if (from > to || Date.parse(to) - Date.parse(from) >= 366 * dayMs) throw bad('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.')
  return { from, to }
}

async function register(c: Ctx) {
  const { orgId } = admins(c)
  const item = await scopedClass(c, validated(uuid, c.req.query('class_id')))
  const month = validated(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), c.req.query('month') ?? today().slice(0, 7))
  const start = month + '-01'
  const next = new Date(start + 'T00:00:00Z')
  next.setUTCMonth(next.getUTCMonth() + 1)
  const end = addDays(next.toISOString().slice(0, 10), -1)
  const [sessions, enrolled, marks] = await Promise.all([
    rows<{ id: string; lesson_date: string; shift: 'morning' | 'afternoon' | null; starts_at: number; attendance_state: string }>(c,
      `SELECT id,lesson_date,shift,starts_at,attendance_state FROM class_sessions WHERE org_id=? AND class_id=?
      AND lesson_date BETWEEN ? AND ? AND status<>'cancelled' ORDER BY lesson_date,starts_at,id LIMIT 200`, orgId, item.id, start, end),
    rows<{ enrollment_id: string; name: string; code: string }>(c, `SELECT e.id AS enrollment_id,st.name,st.code FROM enrollments e
      JOIN students st ON st.org_id=e.org_id AND st.id=e.student_id WHERE e.org_id=? AND e.class_id=? AND e.enrolled_on<=?
      AND (e.withdrawn_on IS NULL OR e.withdrawn_on>?) ORDER BY st.name,st.id LIMIT 150`, orgId, item.id, end, start),
    rows<{ session_id: string; enrollment_id: string; status: Status }>(c, `SELECT a.session_id,a.enrollment_id,a.status
      FROM attendance_records a JOIN class_sessions s ON s.org_id=a.org_id AND s.id=a.session_id
      WHERE a.org_id=? AND a.class_id=? AND s.lesson_date BETWEEN ? AND ? AND s.attendance_state='finalized' AND s.status<>'cancelled'`,
    orgId, item.id, start, end),
  ])
  const byEnrollment = new Map<string, Record<string, Status>>()
  for (const mark of marks) {
    const list = byEnrollment.get(mark.enrollment_id) ?? {}
    list[mark.session_id] = mark.status
    byEnrollment.set(mark.enrollment_id, list)
  }
  const students = enrolled.map(row => {
    const own = byEnrollment.get(row.enrollment_id) ?? {}
    const totals: Totals = { present: 0, late: 0, absent: 0, excused: 0 }
    for (const status of Object.values(own)) if (status !== 'unmarked') totals[status]++
    return { ...row, marks: own, totals, flagged: flagged(totals) }
  })
  return {
    class: { id: item.id, name: item.name }, month, start, end, students,
    sessions: sessions.map(row => ({ id: row.id, date: row.lesson_date, shift: row.shift, starts_at: row.starts_at, finalized: row.attendance_state === 'finalized' })),
  }
}

async function studentTotals(c: Ctx, from: string, to: string) {
  const scope = c.get('scope')
  const [rule, ...args] = classScope(scope)
  return rows<Totals & { class_id: string; class_name: string; id: string; code: string; name: string }>(c,
    `SELECT cl.id AS class_id,cl.name AS class_name,st.id,st.code,st.name,
      COUNT(*) FILTER (WHERE a.status='present') AS present, COUNT(*) FILTER (WHERE a.status='late') AS late,
      COUNT(*) FILTER (WHERE a.status='absent') AS absent, COUNT(*) FILTER (WHERE a.status='excused') AS excused
    FROM attendance_records a JOIN class_sessions s ON s.org_id=a.org_id AND s.id=a.session_id
    JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id
    JOIN enrollments e ON e.org_id=a.org_id AND e.id=a.enrollment_id JOIN students st ON st.org_id=e.org_id AND st.id=e.student_id
    WHERE a.org_id=? AND ${rule} AND s.attendance_state='finalized' AND s.status<>'cancelled' AND s.lesson_date BETWEEN ? AND ?
    GROUP BY cl.id,cl.name,st.id,st.code,st.name ORDER BY cl.name,st.name,st.id LIMIT 5001`, scope.orgId, ...args, from, to)
}

async function summary(c: Ctx) {
  const scope = admins(c)
  const { from, to } = range(c)
  const [rule, ...args] = classScope(scope)
  const [students, sessions, terms] = await Promise.all([
    studentTotals(c, from, to),
    rows<{ class_id: string; class_name: string; due: number; finalized: number }>(c, `SELECT cl.id AS class_id,cl.name AS class_name,
      COUNT(*) FILTER (WHERE s.ends_at<=? OR s.attendance_state='finalized') AS due,
      COUNT(*) FILTER (WHERE s.attendance_state='finalized') AS finalized
      FROM class_sessions s JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id
      WHERE s.org_id=? AND ${rule} AND s.status<>'cancelled' AND s.lesson_date BETWEEN ? AND ?
      GROUP BY cl.id,cl.name ORDER BY cl.name,cl.id LIMIT 300`, now(), scope.orgId, ...args, from, to),
    rows<{ id: string; name: string; starts_on: string; ends_on: string }>(c,
      'SELECT id,name,starts_on,ends_on FROM school_terms WHERE org_id=? ORDER BY starts_on', scope.orgId),
  ])
  if (students.length > 5000) throw bad('Khoảng ngày có quá nhiều dữ liệu. Hãy chọn khoảng hẹp hơn.')
  const classes = sessions.map(row => {
    const own = students.filter(student => student.class_id === row.class_id)
    const totals = own.reduce<Totals>((sum, student) => ({
      present: sum.present + student.present, late: sum.late + student.late,
      absent: sum.absent + student.absent, excused: sum.excused + student.excused,
    }), { present: 0, late: 0, absent: 0, excused: 0 })
    return { id: row.class_id, name: row.class_name, due: row.due, finalized: row.finalized, ...totals, rate: rate(totals),
      flagged: own.filter(flagged).length }
  })
  return { from, to, terms, classes, students: students.map(row => ({ ...row, rate: rate(row), flagged: flagged(row) })), rule: alertRule }
}

export const reports = router()
  .get('/reports/register', async c => result(c, await register(c)))
  .get('/reports/register.csv', async c => {
    const data = await register(c)
    const label = (session: (typeof data.sessions)[number]) => session.date.slice(8, 10) + '/' + session.date.slice(5, 7)
      + (session.shift ? (session.shift === 'morning' ? ' S' : ' C') : '')
    const lines: (string | number)[][] = [
      ['Sổ điểm danh lớp ' + data.class.name + ' tháng ' + data.month.slice(5) + '/' + data.month.slice(0, 4)],
      ['Ký hiệu: để trống = có mặt, M = đi muộn, P = vắng có phép, K = vắng không phép, – = buổi chưa chốt'],
      ['STT', 'Mã', 'Họ và tên', ...data.sessions.map(label), 'Đi muộn (M)', 'Có phép (P)', 'Không phép (K)', 'Tổng buổi vắng'],
      ...data.students.map((student, index) => [index + 1, student.code, student.name,
        ...data.sessions.map(session => session.finalized ? codes[student.marks[session.id] ?? 'unmarked'] : '–'),
        student.totals.late, student.totals.excused, student.totals.absent, student.totals.excused + student.totals.absent]),
    ]
    await audit(c, 'attendance.register_exported', newId(), { classId: data.class.id, month: data.month }).run()
    return download(c, 'so-diem-danh-' + data.month + '.csv', csv(lines))
  })
  .get('/reports/summary', async c => result(c, await summary(c)))
  .get('/reports/summary.csv', async c => {
    const data = await summary(c)
    const percent = (value: number | null) => value === null ? '' : (Math.round(value * 1000) / 10).toLocaleString('vi-VN') + '%'
    const lines: (string | number)[][] = [
      ['Tổng hợp chuyên cần từ ' + data.from.split('-').reverse().join('/') + ' đến ' + data.to.split('-').reverse().join('/')],
      ['Lớp', 'Mã', 'Họ và tên', 'Có mặt', 'Đi muộn', 'Vắng có phép', 'Vắng không phép', 'Tỷ lệ chuyên cần', 'Cần chú ý'],
      ...data.students.map(row => [row.class_name, row.code, row.name, row.present, row.late, row.excused, row.absent,
        percent(row.rate), row.flagged ? 'Có' : '']),
    ]
    await audit(c, 'attendance.summary_exported', newId(), { from: data.from, to: data.to, rows: data.students.length }).run()
    return download(c, 'tong-hop-chuyen-can-' + data.from + '-' + data.to + '.csv', csv(lines))
  })
  .get('/reports/alerts', async c => {
    admins(c)
    const days = validated(z.coerce.number().int().min(7).max(120), c.req.query('days') ?? 30)
    const to = today()
    const from = addDays(to, 1 - days)
    const list = (await studentTotals(c, from, to)).filter(flagged)
      .sort((a, b) => b.absent - a.absent || (b.absent + b.excused) - (a.absent + a.excused) || b.late - a.late || a.name.localeCompare(b.name))
    return result(c, { from, to, rule: alertRule, total: list.length, students: list.slice(0, 20) })
  })
