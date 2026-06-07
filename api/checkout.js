const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  pro: {
    monthly: { name: 'TravelyDeal Pro', amount: 900, mode: 'subscription' },
    onetime: { name: 'TravelyDeal Pro — Lifetime Access', amount: 7900, mode: 'payment' }
  },
  premium: {
    monthly: { name: 'TravelyDeal Premium', amount: 1900, mode: 'subscription' },
    onetime: { name: 'TravelyDeal Premium — Lifetime Access', amount: 14900, mode: 'payment' }
  }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://travelydeal.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { plan, billing } = body || {};
  const cfg = PLANS[plan]?.[billing];
  if (!cfg) return res.status(400).json({ error: 'Invalid plan or billing period' });

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'travelydeal.com';
  const base = `${proto}://${host}`;

  const priceData = {
    currency: 'eur',
    product_data: { name: cfg.name },
    unit_amount: cfg.amount,
  };
  if (cfg.mode === 'subscription') {
    priceData.recurring = { interval: 'month' };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: cfg.mode,
      line_items: [{ price_data: priceData, quantity: 1 }],
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cancel`,
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      metadata: { plan, billing },
    });
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
};
