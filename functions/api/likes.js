/**
 * Cloudflare Pages Function — API endpoint for like/heart counting
 * 
 * GET  /api/likes  → returns total count + whether this IP has liked
 * POST /api/likes  → toggles like for the current IP, returns updated count
 * 
 * D1 binding "DB" must be set in Cloudflare Dashboard:
 *   Pages > my-site-2 > Settings > Functions > D1 database bindings
 *   Variable name: DB, Database: likes-db
 */

async function hashIP(ip) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + '-like-salt-x2-lab-2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const pageId = 'homepage';
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashIP(ip);

  try {
    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM likes WHERE page_id = ?'
    ).bind(pageId).first();
    
    const userResult = await env.DB.prepare(
      'SELECT 1 as liked FROM likes WHERE page_id = ? AND ip_hash = ?'
    ).bind(pageId, ipHash).first();

    return new Response(JSON.stringify({
      count: countResult?.count || 0,
      liked: !!userResult,
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ count: 0, liked: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  const pageId = 'homepage';
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashIP(ip);

  try {
    const existing = await env.DB.prepare(
      'SELECT 1 as liked FROM likes WHERE page_id = ? AND ip_hash = ?'
    ).bind(pageId, ipHash).first();

    if (existing) {
      // Unlike
      await env.DB.prepare(
        'DELETE FROM likes WHERE page_id = ? AND ip_hash = ?'
      ).bind(pageId, ipHash).run();
    } else {
      // Like
      await env.DB.prepare(
        'INSERT INTO likes (page_id, ip_hash) VALUES (?, ?)'
      ).bind(pageId, ipHash).run();
    }

    const countResult = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM likes WHERE page_id = ?'
    ).bind(pageId).first();

    return new Response(JSON.stringify({
      count: countResult?.count || 0,
      liked: !existing,
    }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
