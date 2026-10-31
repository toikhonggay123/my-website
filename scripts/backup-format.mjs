import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';

export const tableOrder=['students','devices','schedules','meal_sessions','settings','users','requests','attendance','outbox','student_qr','audit'];
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const literal=v=>v===null?'NULL':typeof v==='number'&&Number.isSafeInteger(v)?String(v):typeof v==='string'?"'"+v.replaceAll("'","''")+"'":(()=>{throw Error('Unsupported backup value');})();
export const tableHash=rows=>createHash('sha256').update(JSON.stringify(rows.map(row=>Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b)))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex');

export function restoreBackup(backup,migrationsDir='drizzle'){
  if(!backup.complete)throw Error('Backup is incomplete');
  if(Object.keys(backup.tables).sort().join()!==[...tableOrder].sort().join())throw Error('Backup table inventory does not match the application schema');
  const db=new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const migrations=fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort();
    for(const name of migrations)db.exec(fs.readFileSync(migrationsDir+'/'+name,'utf8'));
    const schema=db.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
    for(const trigger of schema.filter(s=>s.type==='trigger'))db.exec('DROP TRIGGER '+ident(trigger.name));
    db.exec('BEGIN');
    const counts={},hashes={};
    for(const table of tableOrder){
      const data=backup.tables[table];
      if(data.next_offset!==null||data.projections.some(p=>p.truncated||p.omitted_columns||p.omitted_rows||p.truncated_values))throw Error('Lossy backup for table '+table);
      const columns=db.prepare('PRAGMA table_info('+ident(table)+')').all().map(c=>c.name);
      if([...columns].sort().join()!==[...data.columns].sort().join())throw Error('Column mismatch for '+table);
      const insert=db.prepare('INSERT INTO '+ident(table)+' ('+columns.map(ident).join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')');
      for(const row of data.rows){
        if(Object.keys(row).sort().join()!==[...columns].sort().join())throw Error('Partial row in '+table);
        insert.run(...columns.map(c=>row[c]));
      }
      counts[table]=data.rows.length; hashes[table]=tableHash(data.rows);
      if(db.prepare('SELECT count(*) n FROM '+ident(table)).get().n!==counts[table])throw Error('Count mismatch for '+table);
    }
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup has broken foreign keys');
    db.exec('COMMIT');
    const output=['PRAGMA defer_foreign_keys=TRUE;'];
    for(const entry of schema.filter(s=>s.type==='table'))output.push(entry.sql+';');
    for(const table of tableOrder){
      const columns=backup.tables[table].columns;
      for(const row of backup.tables[table].rows)output.push('INSERT INTO '+ident(table)+' ('+columns.map(ident).join(',')+') VALUES ('+columns.map(c=>literal(row[c])).join(',')+');');
    }
    for(const entry of schema.filter(s=>s.type!=='table'))output.push(entry.sql+';');
    output.push('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);');
    for(const name of migrations)output.push('INSERT INTO d1_migrations(name) VALUES ('+literal(name)+');');
    output.push('PRAGMA defer_foreign_keys=FALSE;');
    return {sql:output.join('\n')+'\n',counts,hashes,migrations};
  } finally { db.close(); }
}
