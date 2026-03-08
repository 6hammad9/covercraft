import { useState, useEffect } from 'react'
import styles from './Settings.module.css'

const FIELDS = [
  { key: 'name',     label: 'Full Name',       placeholder: 'Joe Smith',          type: 'text' },
  { key: 'email',    label: 'Email',            placeholder: 'you@email.com',               type: 'email' },
  { key: 'phone',    label: 'Phone',            placeholder: '(+49) 11111111111',           type: 'text' },
  { key: 'location', label: 'Location',         placeholder: 'Ilmenau, Germany',            type: 'text' },
  { key: 'linkedin', label: 'LinkedIn',         placeholder: 'linkedin.com/in/yourprofile', type: 'text' },
  { key: 'github',   label: 'GitHub',           placeholder: 'github.com/yourusername',     type: 'text' },
  { key: 'permit',   label: 'Work Permit / Note', placeholder: 'German work permit',        type: 'text' },
]

export default function Settings({ onClose }) {
  const [form, setForm]       = useState({})
  const [status, setStatus]   = useState('idle') // idle | saving | saved | error
  const [loaded, setLoaded]   = useState(false)

  useEffect(() => {
    fetch('/api/candidate')
      .then(r => r.json())
      .then(data => { setForm(data); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  const save = async () => {
    setStatus('saving')
    try {
      const res = await fetch('/api/candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setStatus(data.success ? 'saved' : 'error')
      if (data.success) setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
    }
  }

  const isComplete = FIELDS.every(f => form[f.key]?.trim())

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Your Profile</h2>
            <p className={styles.panelSub}>Saved locally to <code>candidate.json</code> — never in code</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {!loaded ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <>
            <div className={styles.fields}>
              {FIELDS.map(f => (
                <div className={styles.field} key={f.key}>
                  <label className={styles.label}>{f.label}</label>
                  <input
                    className={styles.input}
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {!isComplete && (
              <p className={styles.warning}>⚠ Fill all fields so the agent can write accurate cover letters</p>
            )}

            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                className={`${styles.saveBtn} ${status === 'saving' ? styles.saving : ''}`}
                onClick={save}
                disabled={status === 'saving'}
              >
                {status === 'saving' ? 'Saving...' : status === 'saved' ? '✓ Saved' : 'Save Profile'}
              </button>
            </div>

            {status === 'error' && (
              <p className={styles.error}>✕ Could not save. Is the backend running?</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
