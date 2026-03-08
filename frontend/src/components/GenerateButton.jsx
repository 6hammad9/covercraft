import styles from './GenerateButton.module.css'

export default function GenerateButton({ onClick, status, steps, progress, error, disabled }) {
  const isLoading = status === 'loading'

  return (
    <div className={styles.card} style={{ animationDelay: '0.2s' }}>
      <div className={styles.cardLabel}>
        <span className={styles.stepNum}>03</span>
        Generate
      </div>

      <button
        className={`${styles.btn} ${isLoading ? styles.loading : ''}`}
        onClick={onClick}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <><span className={styles.spinner} /> Agent working...</>
        ) : (
          <><span>Generate Cover Letter</span><span className={styles.btnArrow}>→</span></>
        )}
      </button>

      {(isLoading || steps.length > 0) && (
        <div className={styles.progress}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <div className={styles.steps}>
            {steps.map((step, i) => (
              <div key={i} className={`${styles.stepItem} ${i === steps.length - 1 ? styles.active : styles.done}`}>
                <span className={styles.stepDot}>{i === steps.length - 1 && isLoading ? '◎' : '✓'}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className={styles.error}><span>✕</span> {error}</div>
      )}
    </div>
  )
}