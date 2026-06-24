interface PlanFeature {
  text: string
  included: boolean
}

interface Plan {
  name: string
  price: string
  period?: string
  description: string
  features: PlanFeature[]
  cta: string
  ctaLink: string
  highlighted?: boolean
}

const plans: Plan[] = [
  {
    name: 'Self-Hosted',
    price: 'Free',
    description: 'Run Lattice on your own infrastructure. Full control, zero cost.',
    features: [
      { text: 'Unlimited monitors', included: true },
      { text: 'Unlimited status pages', included: true },
      { text: '90-day history', included: true },
      { text: 'All notification channels', included: true },
      { text: 'Incident management', included: true },
      { text: 'Custom domain', included: true },
      { text: 'Community support', included: true },
    ],
    cta: 'Get Started',
    ctaLink: '#get-started',
  },
  {
    name: 'Hosted',
    price: '$25',
    period: '/year',
    description: 'We run Lattice for you. Zero maintenance, instant setup.',
    features: [
      { text: 'Unlimited monitors', included: true },
      { text: 'Unlimited status pages', included: true },
      { text: '90-day history', included: true },
      { text: 'All notification channels', included: true },
      { text: 'Incident management', included: true },
      { text: 'Custom domain', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Start Free Trial',
    ctaLink: 'https://hosted.lattice.black',
    highlighted: true,
  },
]

function CheckIcon({ included }: { included: boolean }) {
  if (included) {
    return (
      <svg className="w-4 h-4 text-status-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`card p-6 lg:p-8 flex flex-col ${
        plan.highlighted ? 'border-accent/50' : ''
      }`}
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {plan.name}
        </h3>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-4xl font-bold text-text-primary">
            {plan.price}
          </span>
          {plan.period && (
            <span className="text-text-secondary">{plan.period}</span>
          )}
        </div>
        <p className="text-sm text-text-body">
          {plan.description}
        </p>
      </div>

      <ul className="space-y-3 mb-8 flex-grow">
        {plan.features.map((feature) => (
          <li key={feature.text} className="flex items-center gap-3 text-sm">
            <CheckIcon included={feature.included} />
            <span className={feature.included ? 'text-text-body' : 'text-text-secondary'}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      <a
        href={plan.ctaLink}
        className={plan.highlighted ? 'btn-primary text-center' : 'btn-ghost text-center'}
      >
        {plan.cta}
      </a>
    </div>
  )
}

export default function Pricing() {
  return (
    <section className="py-24 lg:py-32 border-b border-border" id="pricing">
      <div className="section-container">
        <div className="max-w-2xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-section-mobile md:text-section-desktop text-text-primary mb-4">
            Simple pricing
          </h2>
          <p className="text-text-body">
            Self-host for free or let us handle the infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border max-w-3xl mx-auto">
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </div>
    </section>
  )
}
