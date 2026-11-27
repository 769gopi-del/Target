const admin = require('firebase-admin');

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT environment variable');
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT must be valid JSON'); }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}

module.exports = { getAdmin };
