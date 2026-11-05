import {createServer} from 'node:http'
import {DatabaseSync} from 'node:sqlite'
import {existsSync,readdirSync,readFileSync} from 'node:fs'
import {randomBytes,createHash} from 'node:crypto'
const sibling = new URL('../../',import.meta.url)
const mealcheckRoot = existsSync(new URL('lib/mealcheck.mjs',sibling)) ? sibling : new URL('mealcheck-cloud/',sibling)
const {MealCheck} = await import(new URL('lib/mealcheck.mjs',mealcheckRoot))
const {directoryAccess,directorySnapshot,directoryMutation} = await import(new URL('lib/shared-directory.mjs',mealcheckRoot))

class Adapter {
  constructor(db){this.db=db}
  prepare(sql){
    const raw=this.db.prepare(sql)
    const build=(args=[])=>({
      bind:(...values)=>build(values),
      execute:()=>raw.columns().length?{results:raw.all(...args),meta:{changes:0}}:
        {results:[],meta:{changes:Number(raw.run(...args).changes)}},
      async run(){return this.execute()},
      async first(){return raw.get(...args)||null},
      async all(){return {results:raw.all(...args)}},
    })
    return build()
  }
  async batch(statements){
    this.db.exec('BEGIN IMMEDIATE')
    try{const values=statements.map(item=>item.execute());this.db.exec('COMMIT');return values}
    catch(error){this.db.exec('ROLLBACK');throw error}
  }
}
export async function createDirectorySource(fullRoster=false){
  const raw=new DatabaseSync(':memory:')
  raw.exec('PRAGMA foreign_keys=ON')
  const directory=new URL('drizzle/',mealcheckRoot)
  for(const file of readdirSync(directory).filter(file=>file.endsWith('.sql')).sort())raw.exec(readFileSync(new URL(file,directory),'utf8'))
  const app=new MealCheck(new Adapter(raw))
  const roster=[
    {code:'001',name:'Học sinh chung QA 01',grade:'9',class:'9B'},
    {code:'002',name:'Học sinh chung QA 02',grade:'9',class:'9B'},
    {code:'003',name:'Học sinh chung QA 03',grade:'8',class:'8A'},
  ];
  if(fullRoster){
    const classes=['6A','6B','7A','7B','8A','8B','9A','9B']
    for(let i=0;i<272;i++){
      const name=classes[i%classes.length]
      roster.push({code:'WEB'+i,name:'Mẫu ClassHub QA '+i,grade:name[0],class:name})
    }
  }
  await app.saveStudents('live',roster,'qa')
  raw.prepare('INSERT INTO student_qr(student_id,space,token,created_at) VALUES (?,?,?,?)')
    .run('live:001','live','fictional-card-retained',0)
  const key=randomBytes(32).toString('hex')
  const server=createServer(async(req,res)=>{
    try{
      const url='http://127.0.0.1:5180'+req.url
      const request=new Request(url,{headers:req.headers})
      const chunks=[]
      for await(const chunk of req)chunks.push(chunk)
      const input=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{}
      let data
      if(req.url==='/qa/mealcheck-edit'){
        await app.saveStudents('live',input.rows,'qa')
        data={saved:true}
      }else if(req.url==='/qa/state'){
        data={snapshot:await directorySnapshot(app,'live'),
          qrHash:createHash('sha256').update(raw.prepare('SELECT token FROM student_qr').get().token).digest('hex')}
      }else{
        await directoryAccess(request,{MEALCHECK_DIRECTORY_KEY:key},{mode:'cloud-live'})
        data=req.method==='POST'?await directoryMutation(app,'live',input):await directorySnapshot(app,'live')
      }
      res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data))
    }catch(error){res.writeHead(error.status??500,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}))}
  })
  await new Promise(resolve=>server.listen(5180,'127.0.0.1',resolve))
  return {key,close:()=>new Promise(resolve=>server.close(()=>{raw.close();resolve()}))}
}
