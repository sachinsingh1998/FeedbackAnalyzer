import { Link } from 'react-router-dom'

export default function Layout({ title, subtitle, backTo, backLabel = 'Back', children }) {
  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">
          <span className="brand-mark">FA</span>
          <div>
            <p className="brand-title">Feedback Analyzer</p>
            <p className="brand-subtitle">Peer evaluation analysis tool</p>
          </div>
        </div>
        {backTo && (
          <Link to={backTo} className="btn btn-secondary">
            ← {backLabel}
          </Link>
        )}
      </header>

      <main className="page-main">
        <section className="hero-card">
          <h1>{title}</h1>
          {subtitle && <p className="hero-subtitle">{subtitle}</p>}
        </section>
        {children}
      </main>
    </div>
  )
}
