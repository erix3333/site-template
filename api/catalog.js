// /api/catalog.js
import { list, put, del } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

const ADMIN_HEADER = 'x-admin-key';

function ok(res, data, status = 200) {
  res.status(status).json(data);
}
function err(res, message, status = 400) {
  res.status(status).json({ error: message });
}

// fallback to repo file if blob not yet created
function readRepoProducts() {
  const fp = path.join(process.cwd(), 'products.json');
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // ----- GET /api/catalog (read) -----
    if (req.method === 'GET' && pathname.endsWith('/api/catalog')) {
      // try blob first
      const { blobs } = await list({ prefix: 'catalog/products.json' });
      if (blobs && blobs.length) {
        // pick the most recent
        blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        const latest = blobs[0];
        const data = await fetch(latest.url, { cache: 'no-store' }).then(r => r.json());
        return ok(res, data);
      }
      // fallback to repo
      return ok(res, readRepoProducts());
    }

    // ----- PUT /api/catalog (write) -----
    if (req.method === 'PUT' && pathname.endsWith('/api/catalog')) {
      const adminKey = req.headers[ADMIN_HEADER] || req.headers[ADMIN_HEADER.toLowerCase()];
      if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return err(res, 'Unauthorized', 401);
      }
      const body = await readJSON(req);
      if (!Array.isArray(body)) return err(res, 'Expected an array of products.');
      // basic sanity validation
      for (const p of body) {
        if (!p.id || !p.title || typeof p.price !== 'number') {
          return err(res, 'Each product needs id, title, price (number).');
        }
      }
      const { url: blobUrl } = await put('catalog/products.json', JSON.stringify(body, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
      });
      return ok(res, { ok: true, url: blobUrl });
    }

    // ----- GET /api/catalog/list (optional) -----
    if (req.method === 'GET' && pathname.endsWith('/api/catalog/list')) {
      const { blobs } = await list({ prefix: 'catalog/products.json' });
      return ok(res, { blobs });
    }

    // ----- DELETE /api/catalog/del?id=... (optional) -----
    if (req.method === 'DELETE' && pathname.endsWith('/api/catalog/del')) {
      const adminKey = req.headers[ADMIN_HEADER] || req.headers[ADMIN_HEADER.toLowerCase()];
      if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
        return err(res, 'Unauthorized', 401);
      }
      const id = url.searchParams.get('id');
      if (!id) return err(res, 'Missing id query param.');
      await del(id);
      return ok(res, { ok: true });
    }

    res.setHeader('Allow', 'GET,PUT,DELETE');
    return err(res, 'Not found', 404);
  } catch (e) {
    console.error(e);
    return err(res, e.message || 'Internal error', 500);
  }
}

async function readJSON(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buf = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(buf || 'null');
}
