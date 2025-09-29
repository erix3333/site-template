// /api/create-checkout-session.js
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // items: [{ id, qty }]
    const { items, meta } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'No items in request.' });
    }

    // Load products.json (relative to project root)
    const productsPath = path.join(process.cwd(), 'products.json');
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

    // Build line items from ids
    let subtotalEUR = 0;
    const line_items = items.map(({ id, qty }) => {
      const p = products.find(x => String(x.id) === String(id));
      if (!p) throw new Error(`Product not found: ${id}`);
      const quantity = Math.max(1, Number(qty) || 1);
      subtotalEUR += p.price * quantity;
      return {
        quantity,
        price_data: {
          currency: 'eur',
          product_data: {
            name: p.title,
            images: p.image ? [p.image] : [],
          },
          unit_amount: Math.round(p.price * 100), // cents
        },
      };
    });

    // Shipping options (compute standard by threshold)
    const FREE_SHIP_THRESHOLD_EUR = 65;
    const STANDARD_EUR = subtotalEUR >= FREE_SHIP_THRESHOLD_EUR ? 0 : 5.0;
    const EXPRESS_EUR = 9.90;

    // We’ll present Standard + Express to the buyer
    const shipping_options = [
      { shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: Math.round(STANDARD_EUR * 100), currency: 'eur' },
          display_name: 'Standard (3–5 days)',
        }
      },
      { shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: Math.round(EXPRESS_EUR * 100), currency: 'eur' },
          display_name: 'Express (1–2 days)',
        }
      },
    ];

    // Determine host for success/cancel
    const origin =
      (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-host'])
        ? `${req.headers['x-forwarded-proto']}://${req.headers['x-forwarded-host']}`
        : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Create session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'link'],
      line_items,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'IE', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PT', 'SE', 'DK', 'FI', 'NO', 'PL', 'CZ', 'AT', 'CH', 'LU', 'GR', 'RO', 'BG', 'HU', 'HR', 'SI', 'SK', 'EE', 'LV', 'LT', 'MT', 'CY', 'PT'] },
      shipping_options,
      success_url: `${origin}/pages/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pages/cancel.html`,
      metadata: {
        // optional: pass along minimal contact info summary for the dashboard
        name: meta?.name || '',
        email: meta?.email || '',
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
