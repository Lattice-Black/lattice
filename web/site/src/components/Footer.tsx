export default function Footer() {
  return (
    <footer className="py-8">
      <div className="section-container">
        <div className="border-t border-border pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 border border-accent flex items-center justify-center">
                <span className="text-accent text-xs font-bold">L</span>
              </div>
              <span className="text-sm text-text-secondary">Lattice</span>
            </div>

            <nav className="flex items-center gap-6">
              <a
                href="https://github.com/lattice-black/lattice"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Docs
              </a>
              <a
                href="#"
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Discord
              </a>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
