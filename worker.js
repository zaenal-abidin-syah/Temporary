// Ubah daftar ini sesuai API yang mau kamu lewati

const STRIP_REQ = [
  "host", "cf-connecting-ip", "cf-ray", "cf-ipcountry",
  "cf-visitor", "x-forwarded-proto", "x-real-ip", "cdn-loop",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const target = url.searchParams.get("url");
    if (!target) return json({ error: "pakai ?url=" }, 400);

    let upstream;
    try {
      upstream = new URL(target);
    } catch {
      return json({ error: "url tidak valid" }, 400);
    }

    if (!["http:", "https:"].includes(upstream.protocol)) {
      return json({ error: "protokol ditolak" }, 400);
    }

    const len = Number(request.headers.get("content-length") || 0);
    if (len > 5 * 1024 * 1024) return json({ error: "body terlalu besar" }, 413);

    const headers = new Headers(request.headers);
    STRIP_REQ.forEach((h) => headers.delete(h));
    if (env && env.UPSTREAM_KEY) {
      headers.set("Authorization", `Bearer ${env.UPSTREAM_KEY}`);
    }

    let res;
    try {
      res = await fetch(upstream.toString(), {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      return json({ error: "upstream gagal", detail: String(e) }, 502);
    }

    const out = new Response(res.body, res);
    Object.entries(CORS).forEach(([k, v]) => out.headers.set(k, v));
    out.headers.set("X-Proxy-By", "cloudflare-worker");
    return out;
  },
};
