import Link from "next/link";

export default function CuentaPage(){
  return <main className="section account-page">
    <div className="section-head">
      <div>
        <span className="eyebrow">MI GLAMOUR</span>
        <h1>Tu cuenta</h1>
        <p className="muted">Inicia sesión para consultar tus pedidos, direcciones, devoluciones y Glam Points.</p>
      </div>
    </div>
    <section className="panel">
      <h2>Acceso seguro</h2>
      <p className="muted">Tus datos personales solo aparecerán después de autenticarte. No mostramos pedidos, puntos ni direcciones de ejemplo como si fueran información real.</p>
      <div className="account-actions">
        <Link className="btn primary" href="/api/auth/signin">Iniciar sesión</Link>
        <Link className="btn ghost" href="/contacto">Necesito ayuda</Link>
      </div>
    </section>
  </main>;
}
