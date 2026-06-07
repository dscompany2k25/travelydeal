const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log('Payment completed:', {
        email: session.customer_details?.email,
        mode: session.mode,
        plan: session.metadata?.plan,
        billing: session.metadata?.billing,
        amount_eur: (session.amount_total / 100).toFixed(2),
      });
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log('Subscription cancelled:', sub.id, sub.customer);
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      console.log('Payment failed:', inv.customer_email, inv.id);
      break;
    }
  }

  return res.json({ received: true });
};

module.exports.config = {
  api: { bodyParser: false }
};
