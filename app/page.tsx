export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Portfolio</h1>
            <p className="text-xs text-muted">Personal investment &amp; asset dashboard</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <section className="rounded-lg border border-hairline bg-surface p-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Setting things up</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            The dashboard is being built phase by phase — sign-in, holdings, live
            prices, and daily value snapshots are on the way.
          </p>
        </section>
      </main>
    </div>
  );
}
