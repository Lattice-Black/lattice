import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import Features from './components/Features'
import StatusPreview from './components/StatusPreview'
import OpenSource from './components/OpenSource'
import Pricing from './components/Pricing'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <HowItWorks />
      <Features />
      <StatusPreview />
      <OpenSource />
      <Pricing />
      <Footer />
    </div>
  )
}

export default App
