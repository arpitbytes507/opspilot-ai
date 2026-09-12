const featureCards = [
  {
    title: 'Observability Signals',
    description: 'Capture logs, errors, deploy events, and service health signals in one operational workspace.',
  },
  {
    title: 'Incident Correlation',
    description: 'Connect abnormal behavior to the services, timelines, and changes most likely involved.',
  },
  {
    title: 'AI Root-Cause Insights',
    description: 'Surface probable causes and investigation paths before teams spend hours chasing the wrong signal.',
  },
  {
    title: 'Operational Readiness',
    description: 'Create a foundation for postmortems, handoffs, and more resilient engineering workflows.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-6 py-16 lg:px-8">
        <div className="mb-10 inline-flex w-fit items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm font-medium text-sky-300">
          Platform foundation is ready
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">
              OpsPilot AI
            </p>
            <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-white md:text-6xl">
              AI-Powered Incident Intelligence for Modern Engineering Teams
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              OpsPilot AI helps engineering teams detect issues faster, correlate signals across services, and prepare for confident investigation with AI-assisted insight.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#platform"
                className="rounded-md bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Explore platform
              </a>
              <a
                href="#foundation"
                className="rounded-md border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
              >
                Development status
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-sky-950/30">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">System status</p>
                <p className="text-2xl font-semibold text-white">Operational</p>
              </div>
              <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                foundation ready
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Core services</p>
                <p className="mt-2 text-lg font-medium text-sky-300">Web • API • AI Service</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm text-slate-400">Environment</p>
                <p className="mt-2 text-lg font-medium text-slate-100">Local monorepo foundation</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-t border-slate-800 bg-slate-950/80">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">Architecture preview</p>
            <h2 className="mt-3 text-3xl font-bold text-white">A platform built for observability and incident response</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div className="mb-4 h-10 w-10 rounded-lg bg-sky-500/10 ring-1 ring-sky-500/20" />
                <h3 className="text-xl font-semibold text-white">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="foundation" className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">Current phase</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Platform foundation is ready</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300">
            This repository is being initialized as a clean workspace foundation for the full OpsPilot AI platform. The core web app, API, shared package, and AI service are in place and ready for the next implementation milestones.
          </p>
        </div>
      </section>
    </main>
  );
}
