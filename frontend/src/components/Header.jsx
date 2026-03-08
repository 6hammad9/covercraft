import styles from './Header.module.css'

export default function Header({ onOpenSettings }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <div className={styles.logoMark}>CC</div>
        <span className={styles.logoName}>CoverCraft</span>
      </div>
      <div className={styles.right}>
        <span className={`${styles.pill} ${styles.pillActive}`}>● running</span>
        <span className={styles.pill}>llama3.2</span>
        <button className={styles.settingsBtn} onClick={onOpenSettings} title="Profile settings">
          ⚙ Profile
        </button>
      </div>
    </header>
  )
}