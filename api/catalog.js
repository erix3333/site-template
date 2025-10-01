// /api/catalog.js
import { put, list, del } from '@vercel/blob';

const FILE_NAME = 'products.json';           // we’ll store one canonical JSON file
const PUBLIC_CACHE_SECONDS = 30;             // small cache for GETs

function bad(res, code, msg){ return res.status(code).json({ error: msg }); }
function ok(res, data){ return res.status(200).json(data); }

// Very light “auth” via header. Admin UI will send: Authorization: Bearer <ADMIN_KEY>
function isAdmin(req){
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  return token && token === process.env.ADMIN_KEY;
}

async function fetchCurrentJSON(){
  // Find the blob named products.json (if any)
  const { blobs } = await list({ prefix: FILE_NAME });
  const existing = blobs.find(b => b.pathname === FILE_NAME);
  if (!existing) return [];
  const r = await fetch(existing.url, { cache: 'no-store' });
  return await r.json();
}

export default async function handler(req, res){
  try{
    if (req.method === 'GET'){
      const data = await fetchCurrentJSON();
      // small cache control for the CDN edge
      res.setHeader('Cache-Control', `public, max-age=${PUBLIC_CACHE_SECONDS}`);
      return ok(res, data);
    }

    // All mutations require admin
    if (!isAdmin(req)) return bad(res, 401, 'Unauthorized');

    // Parse body once
    const body = req.body && typeof req.body === 'object' ? req.body
               : req.body ? JSON.parse(req.body) : null;

    if (req.method === 'PUT'){
      // Replace entire catalog with provided array
      if (!Array.isArray(body)) return bad(res, 400, 'Body must be a JSON array.');
      const uploaded = await put(FILE_NAME, JSON.stringify(body, null, 2), {
        access: 'public', contentType: 'application/json; charset=utf-8',
      });
      return ok(res, { ok: true, url: uploaded.url, count: body.length });
    }

    if (req.method === 'PATCH'){
      // Upsert a single product (by id). Body: { id, ...fields }
      if (!body || !body.id) return bad(res, 400, 'Missing product id.');
      const data = await fetchCurrentJSON();
      const i = data.findIndex(p => String(p.id) === String(body.id));
      if (i === -1) data.push(body); else data[i] = { ...data[i], ...body };
      const uploaded = await put(FILE_NAME, JSON.stringify(data, null, 2), {
        access: 'public', contentType: 'application/json; charset=utf-8',
      });
      return ok(res, { ok:true, url: uploaded.url, count: data.length });
    }

    if (req.method === 'DELETE'){
      // Delete by id: ?id=p-001
      const id = req.query?.id;
      if (!id) return bad(res, 400, 'Missing id query param.');
      const data = await fetchCurrentJSON();
      const filtered = data.filter(p => String(p.id) !== String(id));
      const uploaded = await put(FILE_NAME, JSON.stringify(filtered, null, 2), {
        access: 'public', contentType: 'application/json; charset=utf-8',
      });
      return ok(res, { ok:true, url: uploaded.url, count: filtered.length });
    }

    return bad(res, 405, 'Method not allowed');
  } catch (err){
    console.error(err);
    return bad(res, 500, err.message || 'Server error');
  }
}