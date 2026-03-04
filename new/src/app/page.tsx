import styles from './page.module.scss';

export default function Home() {
  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1>Vítejte v Armygame</h1>
        <p>Přepis původní hry do Next.js + Sass + Ironbean</p>
      </main>
    </div>
  );
}
