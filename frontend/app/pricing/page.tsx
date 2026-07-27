export default function PricingPage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-center mb-2">Pricing</h1>
      <p className="text-center text-muted-foreground mb-12">Choose the plan that works for you.</p>
      <div className="grid md:grid-cols-3 gap-6">
        {[
          { name: "Free", price: "₹0", features: ["Unlimited reading", "3 articles/month", "Basic analytics"] },
          { name: "Pro", price: "₹299/mo", features: ["Unlimited articles", "Newsletter", "Advanced analytics", "Custom domain"] },
          { name: "Business", price: "₹999/mo", features: ["Everything in Pro", "Team accounts", "API access", "Priority support"] },
        ].map(plan => (
          <div key={plan.name} className="border rounded-lg p-6 text-center hover:shadow-lg transition-shadow">
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <div className="text-3xl font-bold mb-4">{plan.price}</div>
            <ul className="space-y-2 text-sm text-muted-foreground mb-6">
              {plan.features.map(f => <li key={f}>✓ {f}</li>)}
            </ul>
            <button className="w-full bg-primary text-primary-foreground py-2 rounded-lg">Get Started</button>
          </div>
        ))}
      </div>
    </div>
  );
}
