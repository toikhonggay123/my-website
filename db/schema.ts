import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const users = sqliteTable('users', { id: text('id').primaryKey(), email: text('email').notNull().unique(), name: text('name').notNull(), role: text('role').notNull(), active: integer('active').notNull().default(1) });
export const students = sqliteTable('students', { id: text('id').primaryKey(), space: text('space').notNull(), code: text('code').notNull(), name: text('name').notNull(), grade: text('grade').notNull(), class: text('class').notNull(), active: integer('active').notNull().default(1) }, t => [uniqueIndex('student_code').on(t.space,t.code),index('student_class').on(t.space,t.grade,t.class)]);
export const studentQr = sqliteTable('student_qr', { student_id: text('student_id').primaryKey().references(()=>students.id), space: text('space').notNull(), token: text('token').notNull().unique(), created_at: integer('created_at').notNull() });
export const schedules = sqliteTable('schedules', { id: text('id').primaryKey(), space: text('space').notNull(), meal: text('meal').notNull(), enabled: integer('enabled').notNull().default(0), start: text('start'), end: text('end') });
export const sessions = sqliteTable('meal_sessions', { id: text('id').primaryKey(), space: text('space').notNull(), date: text('date').notNull(), meal: text('meal').notNull(), override: text('override') });
export const devices = sqliteTable('devices', { id: text('id').primaryKey(), space: text('space').notNull(), name: text('name').notNull(), hash: text('hash').notNull().unique(), active: integer('active').notNull().default(1), lock_until: integer('lock_until').notNull().default(0) });
export const requests = sqliteTable('requests', { id: text('id').primaryKey(), space: text('space').notNull(), student_id: text('student_id').notNull().references(()=>students.id), session_id: text('session_id').notNull().references(()=>sessions.id), device_id: text('device_id').notNull().references(()=>devices.id), status: text('status').notNull().default('pending'), created_at: integer('created_at').notNull(), processed_at: integer('processed_at'), actor: text('actor'), reason: text('reason'), lock_until: integer('lock_until') }, t=>[index('requests_queue').on(t.space,t.status,t.created_at)]);
export const attendance = sqliteTable('attendance', { seq: integer('seq').primaryKey({autoIncrement:true}), request_id: text('request_id').notNull().unique().references(()=>requests.id), space: text('space').notNull(), student_id: text('student_id').notNull().references(()=>students.id), session_id: text('session_id').notNull().references(()=>sessions.id), code: text('code').notNull(), name: text('name').notNull(), grade: text('grade').notNull(), class: text('class').notNull(), confirmed_at: integer('confirmed_at').notNull(), teacher: text('teacher').notNull() },t=>[uniqueIndex('one_meal_per_student').on(t.student_id,t.session_id),index('attendance_session').on(t.space,t.session_id)]);
export const audit = sqliteTable('audit', { seq: integer('seq').primaryKey({autoIncrement:true}), space: text('space').notNull(), at: integer('at').notNull(), actor: text('actor').notNull(), action: text('action').notNull(), result: text('result').notNull() });
export const outbox = sqliteTable('outbox', { id: integer('id').primaryKey({autoIncrement:true}), attendance_seq: integer('attendance_seq').notNull().unique().references(()=>attendance.seq), status: text('status').notNull().default('pending'), attempts: integer('attempts').notNull().default(0), next_at: integer('next_at').notNull().default(0), error: text('error') });
export const directoryRevisions = sqliteTable('directory_revisions', {
  space: text('space').primaryKey(), revision: integer('revision').notNull().default(0),
});
export const directoryClasses = sqliteTable('directory_classes', {
  id: text('id').primaryKey(), space: text('space').notNull(), grade: text('grade').notNull(), name: text('name').notNull(),
}, table => [uniqueIndex('directory_class_name').on(table.space,table.grade,table.name)]);
export const directoryOperations = sqliteTable('directory_operations', {
  id: text('id').primaryKey(), space: text('space').notNull(), request_hash: text('request_hash').notNull(),
  nonce: text('nonce').notNull(), entity_id: text('entity_id').notNull(), applied: integer('applied').notNull().default(1),
  created_at: integer('created_at').notNull(),
});
