// /api/create-checkout-session.js
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Load products.json once (bundled with the function)
const PRODUCTS_PATH = path.join(process.cwd(), 'products.json');
let PRODUCTS = [];
try {
  const raw = fs.readFileSync(PRODUCTS_PATH, 'utf8');
  PRODUCTS = JSON.parse(raw);
} catch (e) {
  console.error('Failed to load products.json', e);
}

function findProduct(id) {
  return PRODUCTS.find(p => p.id === id);
}

module.exports = async (req, res) => {
  // Allow same-origin POST only (Vercel serves both frontend & API)
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, contact } = req.body || {};
    // items is expected like: { "prod_1": 2, "prod_7": 1 }
    if (!items || typeof items !== 'object')
      return res.status(400).json({ error: 'Missing items' });

    // Build Stripe line_items from our trusted products.json (server-side pricing)
    const line_items = [];
    for (const id of Object.keys(items)) {
      const qty = Math.max(1, parseInt(items[id] || '1', 10));
      const p = findProduct(id);
      if (!p) continue;

      line_items.push({
        quantity: qty,
        price_data: {
          currency: 'eur',                 // keep EUR first; you can extend later
          product_data: {
            name: p.title,
            description: p.excerpt || '',
            images: p.image ? [p.image] : []
          },
          unit_amount: Math.round((p.price || 0) * 100) // cents
        }
      });
    }

    if (!line_items.length) {
      return res.status(400).json({ error: 'No valid items' });
    }

    // Shipping options (simple)
    const shipping_options = [
      { shipping_rate_data: {
          display_name: 'Standard',
          type: 'fixed_amount',
          fixed_amount: { amount: 500, currency: 'eur' }, // €5 unless €0 logic moved here
          delivery_estimate: { minimum: { unit: 'business_day', value: 3 }, maximum: { unit: 'business_day', value: 5 } }
      }},
      { shipping_rate_data: {
          display_name: 'Express',
          type: 'fixed_amount',
          fixed_amount: { amount: 990, currency: 'eur' }, // €9.90
          delivery_estimate: { minimum: { unit: 'business_day', value: 1 }, maximum: { unit: 'business_day', value: 2 } }
      }}
    ];

    const origin = req.headers.origin || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      allow_promotion_codes: true,
      shipping_address_collection: { allowed_countries: ['US', 'GB', 'IE', 'FR', 'DE', 'ES', 'IT', 'NL', 'PL', 'BE', 'PT', 'SE', 'DK', 'AT', 'FI', 'GR', 'RO', 'HU', 'CZ', 'SK', 'BG', 'HR', 'SI', 'EE', 'LV', 'LT'] },
      shipping_options,
      // optional: prefill email if provided
      customer_email: contact?.email ? String(contact.email) : undefined,
      success_url: `${origin}/pages/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pages/checkout.html`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
