// /api/admin/save-catalog.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // simple auth
  const sent = req.headers['x-admin-token'] || req.query.token;
  if (!process.env.ADMIN_TOKEN || sent !== process.env.ADMIN_TOKEN){
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try{
    const { products } = req.body || {};
    if (!Array.isArray(products)) return res.status(400).json({ error: 'Bad payload' });

    const target = path.join(process.cwd(), 'products.json');
    fs.writeFileSync(target, JSON.stringify(products, null, 2), 'utf8');
    return res.status(200).json({ ok: true });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: err.message || 'Write failed' });
  }
}
