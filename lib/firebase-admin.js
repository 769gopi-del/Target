const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.app();
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  if (!serviceAccount) throw new Error('Firebase Admin credentials are missing');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.app();
}

function getDb() { getAdminApp(); return admin.firestore(); }
async function authenticate(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw Object.assign(new Error('Login required'), { status: 401 });
  getAdminApp();
  try { return await admin.auth().verifyIdToken(header.slice(7)); }
  catch { throw Object.assign(new Error('Invalid or expired login token'), { status: 401 }); }
}
module.exports = { admin, getDb, authenticate };
