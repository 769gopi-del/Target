function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const configured = (process.env.FRONTEND_ORIGIN || '')
    .split(',').map(x => x.trim()).filter(Boolean);
  const allowed = new Set([
    'https://targetrank.vercel.app',
    'https://769gopi-del.github.io',
    ...configured
  ]);
  if (allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  return req.method === 'OPTIONS';
}
function send(res, status, body) {
  return res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(body));
}
module.exports = { applyCors, send };
