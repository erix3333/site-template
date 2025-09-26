// api/create-checkout-session.js
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });
  const {
    line_items = [],
    allow_promotion_codes = true,
    shipping_options = [],
    customer_email = '',
    metadata = {}
  } = req.body || {};

  try {
    // Convert our simple shipping options into Stripe's format (EUR assumed)
    const shipping_rate_data = shipping_options.map(opt => ({
      shipping_rate_data: {
        display_name: opt.label,
        type: 'fixed_amount',
        fixed_amount: { amount: opt.amount, currency: 'eur' },
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 1 },
          maximum: { unit: 'business_day', value: 7 }
        }
      }
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'link'],
      line_items,
      allow_promotion_codes,
      shipping_address_collection: { allowed_countries: ['US','CA','GB','IE','DE','FR','ES','IT','NL','BE','PT','SE','DK','NO','FI','AT','PL','RO','BG','GR','HU','CZ','SK','SI','HR','EE','LV','LT'] },
      shipping_options: shipping_rate_data,
      phone_number_collection: { enabled: true },
      customer_email,
      metadata,
      success_url: `${process.env.PUBLIC_BASE_URL}/pages/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.PUBLIC_BASE_URL}/pages/cancel.html`
    });

    return res.status(200).json({ id: session.id });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: { message: err.message } });
  }
}
