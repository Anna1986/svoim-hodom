export default function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <>
      <header className="page-header">
        <h1>{title}</h1>
      </header>
      <div className="empty">
        <div className="empty-icon">🚧</div>
        <p>{text}</p>
      </div>
    </>
  )
}
