import styles from './JobInput.module.css'

export default function JobInput({ mode, setMode, value, onChange, disabled }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardLabel}>
        <span className={styles.stepNum}>01</span>
        Job Posting
      </div>

      <div className={styles.toggle}>
        <button className={`${styles.toggleBtn} ${mode === 'paste' ? styles.active : ''}`} onClick={() => setMode('paste')} disabled={disabled}>Paste Text</button>
        <button className={`${styles.toggleBtn} ${mode === 'url' ? styles.active : ''}`} onClick={() => setMode('url')} disabled={disabled}>From URL</button>
      </div>

      {mode === 'paste' ? (
        <>
          <textarea className={styles.textarea} placeholder={"Paste the full job description here...\n\nThe more detail you include — company background, requirements, tech stack — the more tailored your letter will be."} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />
          <p className={styles.hint}>→ LinkedIn, Indeed, Glassdoor, any job board — paste the full text</p>
        </>
      ) : (
        <>
          <input className={styles.input} type="text" placeholder="https://careers.company.com/job/..." value={value} onChange={e => onChange(e.target.value)} disabled={disabled} />
          <p className={styles.hint}>→ Works best with Indeed, Glassdoor, company career pages</p>
        </>
      )}
    </div>
  )
}