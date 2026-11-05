import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionForm, Field, LoadView, Notice, Panel, send, useLoad, value } from './ui'

export type Directory = {
  enabled: boolean; revision: number; syncedAt: number
  classes: { id: string; name: string; grade: string; class_id: string }[]
}
export const directoryForm = (data: FormData) => ({
  class_id: value(data, 'class_id'), revision: Number(value(data, 'revision')),
  active: data.has('active') ? 1 : 0, operation_id: value(data, 'operation_id'),
})
export function DirectoryStudentFields({ directory, item }: {
  directory: Directory; item?: { code: string; name: string; active: number; directory_class_id?: string; directory_revision?: number }
}) {
  const [operationId] = useState(() => crypto.randomUUID())
  return <>
    <input type="hidden" name="operation_id" value={operationId} />
    <input type="hidden" name="revision" value={item?.directory_revision ?? directory.revision} />
    <Field label="Mã học sinh"><input name="code" required maxLength={150} defaultValue={item?.code} readOnly={Boolean(item)} /></Field>
    <Field label="Họ và tên"><input name="name" required maxLength={150} defaultValue={item?.name} /></Field>
    <Field label="Lớp sinh hoạt"><select name="class_id" defaultValue={item?.directory_class_id ?? ''} required>
      <option value="">Chọn lớp…</option>
      {directory.classes.map(cl => <option key={cl.id} value={cl.id}>Khối {cl.grade} · {cl.name}</option>)}
    </select></Field>
    <label className="check"><input type="checkbox" name="active" defaultChecked={item ? Boolean(item.active) : true} /> Đang theo học</label>
  </>
}
export function DirectoryBanner({ api, base }: { api: string; base: string }) {
  const load = useLoad<{ data: Directory }>(api + '/shared-directory')
  return <LoadView load={load}>{({ data }) => data.enabled && <div className="notice success">
    <span>Danh sách dùng chung với MealCheck web. <Link to={base + '/thiet-lap'}>Quản lý lớp chung</Link></span>
    <button onClick={() => location.reload()}>Cập nhật</button>
  </div>}</LoadView>
}
function SharedClassForm({ directory, item }: { directory: Directory; item?: Directory['classes'][number] }) {
  const [operationId] = useState(() => crypto.randomUUID())
  return <>
    <input type="hidden" name="operation_id" value={operationId} />
    <input type="hidden" name="revision" value={directory.revision} />
    <Field label="Khối"><input name="grade" maxLength={40} defaultValue={item?.grade} required /></Field>
    <Field label="Tên lớp chung"><input name="name" maxLength={150} defaultValue={item?.name} required /></Field>
  </>
}
export function DirectorySettings({ api }: { api: string }) {
  const load = useLoad<{ data: Directory }>(api + '/shared-directory')
  const [message, setMessage] = useState('')
  const [epoch, setEpoch] = useState(0)
  const saved = () => {
    setMessage('Đã lưu lớp vào danh sách chung.')
    setEpoch(old => old + 1)
    load.refresh()
  }
  const submit = (data: FormData, id?: string) => send(api + '/shared-directory/classes', {
    id, name: value(data, 'name'), grade: value(data, 'grade'),
    revision: Number(value(data, 'revision')), operation_id: value(data, 'operation_id'),
  })
  return <Panel title="Lớp dùng chung với MealCheck">
    <Notice>{message}</Notice>
    <LoadView load={load}>{({ data }) => <>
      <p className="muted">Thêm hoặc đổi tên lớp tại đây để cả hai ứng dụng cùng sử dụng.</p>
      <ActionForm label="Thêm lớp chung" key={epoch} action={form => submit(form)} onSaved={saved}>
        <SharedClassForm directory={data} />
      </ActionForm>
      <div className="list">{data.classes.map(cl => <details className="detail-row" key={cl.id + ':' + data.revision}>
        <summary><strong>{cl.name}</strong><span>Khối {cl.grade}</span></summary>
        <ActionForm action={form => submit(form, cl.id)} onSaved={saved}><SharedClassForm directory={data} item={cl} /></ActionForm>
      </details>)}</div>
    </>}</LoadView>
  </Panel>
}
