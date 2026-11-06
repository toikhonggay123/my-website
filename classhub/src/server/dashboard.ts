import { z } from 'zod'
import { type Ctx, classScope, dayMs, db, now, query, result, today, validated } from './core'

export type ActivityCounts = { done: number; pending: number; planned: number }
export type ActivityDay = ActivityCounts & { date: string }
export type AttendanceCounts = { present: number; late: number; absent: number; excused: number }
export type ClassActivity = ActivityCounts & AttendanceCounts & { id: string; name: string; code: string }
export type DashboardAnalytics = {
  from: string; to: string; daily: ActivityDay[]; attendance: AttendanceCounts
  classes: ClassActivity[]; classPage: number; classHasMore: boolean
}

const activityCounts = `COUNT(*) FILTER (WHERE stage='done') AS done,
  COUNT(*) FILTER (WHERE stage='pending') AS pending, COUNT(*) FILTER (WHERE stage='planned') AS planned`
const attendanceCounts = `COUNT(*) FILTER (WHERE a.status='present') AS present,
  COUNT(*) FILTER (WHERE a.status='late') AS late, COUNT(*) FILTER (WHERE a.status='absent') AS absent,
  COUNT(*) FILTER (WHERE a.status='excused') AS excused`
const pageSize = 8

export async function dashboardAnalytics(c: Ctx) {
  const scope = c.get('scope')
  const [rule, ...scopeArgs] = classScope(scope)
  const days = Number(validated(z.enum(['7', '14', '30']), c.req.query('days') ?? '7'))
  const classPage = validated(z.coerce.number().int().min(1).max(10_000), c.req.query('class_page') ?? 1)
  const to = today()
  const from = new Date(Date.parse(to) - (days - 1) * dayMs).toISOString().slice(0, 10)
  const visible = `WITH activity AS (
    SELECT s.org_id,s.id,s.class_id,s.lesson_date,CASE
      WHEN s.attendance_state='finalized' THEN 'done'
      WHEN s.ends_at<=? THEN 'pending'
      ELSE 'planned' END AS stage
    FROM class_sessions s JOIN classes cl ON cl.org_id=s.org_id AND cl.id=s.class_id
    WHERE s.org_id=? AND ${rule} AND s.lesson_date BETWEEN ? AND ?
      AND s.status<>'cancelled' AND (?<>'teacher' OR s.teacher_id=?)
  )`
  const args = [now(), scope.orgId, ...scopeArgs, from, to, scope.role, scope.userId]
  const marked = `FROM activity v JOIN attendance_records a ON a.org_id=v.org_id AND a.session_id=v.id
    WHERE v.stage='done'`
  const [daily, attendance, classes] = await db(c).batch([
    query(c, `${visible} SELECT lesson_date AS date,${activityCounts} FROM activity GROUP BY lesson_date`, ...args),
    query(c, `${visible} SELECT ${attendanceCounts} ${marked}`, ...args),
    query(c, `${visible},
      by_class AS (SELECT class_id,${activityCounts} FROM activity GROUP BY class_id),
      marks AS (SELECT v.class_id,${attendanceCounts} ${marked} GROUP BY v.class_id)
      SELECT cl.id,cl.name,cl.code,coalesce(v.done,0) AS done,coalesce(v.pending,0) AS pending,
        coalesce(v.planned,0) AS planned,coalesce(m.present,0) AS present,coalesce(m.late,0) AS late,
        coalesce(m.absent,0) AS absent,coalesce(m.excused,0) AS excused
      FROM classes cl LEFT JOIN by_class v ON v.class_id=cl.id LEFT JOIN marks m ON m.class_id=cl.id
      WHERE cl.org_id=? AND ${rule} AND (v.class_id IS NOT NULL OR cl.status IN ('active','scheduled'))
      ORDER BY pending DESC,done DESC,planned DESC,cl.name,cl.id LIMIT ? OFFSET ?`,
    ...args, scope.orgId, ...scopeArgs, pageSize + 1, (classPage - 1) * pageSize),
  ])
  const byDate = new Map((daily.results as ActivityDay[]).map(day => [day.date, day]))
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.parse(from) + index * dayMs).toISOString().slice(0, 10)
    return byDate.get(date) ?? { date, done: 0, pending: 0, planned: 0 }
  })
  return result<DashboardAnalytics>(c, {
    from, to, daily: series, attendance: attendance.results[0] as AttendanceCounts,
    classes: (classes.results as ClassActivity[]).slice(0, pageSize), classPage,
    classHasMore: classes.results.length > pageSize,
  })
}
