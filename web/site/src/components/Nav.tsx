export default function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="section-container flex items-center justify-between py-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 border border-accent flex items-center justify-center">
            <span className="text-accent text-xs font-bold">L</span>
          </div>
          <span className="text-sm font-medium text-text-primary">Lattice</span>
        </a>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#get-started"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Get Started
          </a>
          <a
            href="#demo"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Demo
          </a>
          <a
            href="#features"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Pricing
          </a>
          <a
            href="https://github.com/lattice-black/lattice"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            GitHub
          </a>
        </nav>

        {/* CTA */}
        <a
          href="#get-started"
          className="text-sm text-accent border border-accent px-4 py-2 hover:bg-accent hover:text-background transition-colors"
        >
          Deploy
        </a>
      </div>
    </header>
  )
}