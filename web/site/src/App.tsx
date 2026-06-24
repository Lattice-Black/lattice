import Nav from './components/Nav'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import Features from './components/Features'
import StatusPreview from './components/StatusPreview'
import Pricing from './components/Pricing'
import OpenSource from './components/OpenSource'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <HowItWorks />
      <Features />
      <StatusPreview />
      <Pricing />
      <OpenSource />
      <Footer />
    </div>
  )
}

export default App