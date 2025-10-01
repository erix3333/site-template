// /api/signed-upload.js
import { put } from '@vercel/blob';

function isAdmin(req){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  return token && token === process.env.ADMIN_KEY;
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

export default async function handler(req, res){
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAdmin(req)) return res.status(401).json({ error: 'Unauthorized' });

  try{
    // body: { filename, base64 }
    const { filename, base64 } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (!filename || !base64) return res.status(400).json({ error:'Missing filename or base64' });

    // Convert base64 dataURL → Buffer
    const m = base64.match(/^data:(.*?);base64,(.*)$/);
    const contentType = m ? m[1] : 'application/octet-stream';
    const buf = Buffer.from(m ? m[2] : base64, 'base64');

    const uploaded = await put(`images/${Date.now()}_${filename}`, buf, {
      access: 'public',
      contentType
    });

    return res.status(200).json({ url: uploaded.url });
  } catch (err){
    console.error(err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}