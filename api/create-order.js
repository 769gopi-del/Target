const crypto = require('crypto');
const { getAdmin } = require('../lib/firebase-admin');
const { applyCors, send } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return send(res, 500, { error: 'Razorpay keys are not configured' });

    const admin = getAdmin();
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return send(res, 401, { error: 'Google login required' });
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.email_verified) return send(res, 403, { error: 'Verified Google account required' });

    const { examKey, itemType, itemId } = req.body || {};
    if (typeof examKey !== 'string' || !examKey || !['plan', 'pdf'].includes(itemType) || itemId == null)
      return send(res, 400, { error: 'Invalid exam or purchase item' });

    // Read the admin-managed price from Firestore; never trust a price sent by the browser.
    const db = admin.firestore();
    const stateSnap = await db.collection('appData').doc('main').get();
    if (!stateSnap.exists) return send(res, 409, { error: 'Admin payment catalogue is not published yet' });
    const state = stateSnap.data() || {};
    const exam = (state.examDatabase || {})[examKey];
    if (!exam) return send(res, 404, { error: 'Exam not found' });

    let item;
    if (itemType === 'plan') item = (exam.plans || []).find(x => String(x.id) === String(itemId));
    if (itemType === 'pdf') item = (exam.pdfs || []).find(x => String(x.id) === String(itemId));
    const amount = Number(item && item.price);
    if (!item || !Number.isFinite(amount) || amount <= 0 || amount > 100000)
      return send(res, 400, { error: 'This paid item is unavailable or has an invalid price' });

    const receipt = `tr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const payload = {
      amount: Math.round(amount * 100), currency: 'INR', receipt,
      notes: { uid: decoded.uid, examKey, itemType, itemId: String(itemId) }
    };
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const order = await response.json();
    if (!response.ok) return send(res, 502, { error: order.error?.description || 'Razorpay order creation failed' });

    await db.collection('paymentOrders').doc(order.id).set({
      uid: decoded.uid, email: decoded.email || null, examKey,
      itemType, itemId: String(itemId), amount: payload.amount,
      currency: 'INR', status: 'created', createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return send(res, 200, { orderId: order.id, amount: order.amount, currency: order.currency, keyId });
  } catch (error) {
    console.error('create-order error:', error);
    return send(res, 500, { error: 'Could not create payment order' });
  }
};
