import StatusMockup from './StatusMockup'

export default function Hero() {
  return (
    <section className="min-h-screen flex items-center border-b border-border">
      <div className="section-container py-16 md:py-0">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-8 items-center">
          <div className="lg:col-span-3 space-y-8">
            <div>
              <span className="inline-block text-accent font-mono text-xs uppercase tracking-widest mb-6">
                Open Source &middot; Self-Hosted
              </span>
              <h1 className="text-hero-mobile md:text-hero-desktop text-text-primary">
                Your services,
                <br />
                under watch.
              </h1>
            </div>

            <p className="text-lg md:text-xl text-text-body max-w-xl">
              Single binary. Zero dependencies. Beautiful status pages.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#get-started" className="btn-primary text-center">
                Get Started
                <span className="ml-2">&rarr;</span>
              </a>
              <a href="#demo" className="btn-ghost text-center">
                View Demo
              </a>
            </div>
          </div>

          <div className="lg:col-span-2">
            <StatusMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
