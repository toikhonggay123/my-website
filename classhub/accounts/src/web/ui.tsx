import { useState, type FormEvent, type ReactNode } from 'react'
import { message } from './api'

export function useForm(action: (data: FormData) => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await action(new FormData(event.currentTarget)) } catch (failure) { setError(message(failure)) } finally { setBusy(false) }
  }
  return { busy, error, submit, setError }
}
export const field = (data: FormData, name: string) => String(data.get(name) ?? '')
export function Problem({ children }: { children: ReactNode }) {
  return children ? <p className="ac-error edu-rise" role="alert">{children}</p> : null
}
