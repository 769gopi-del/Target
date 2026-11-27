const crypto = require('crypto');
const { getAdmin } = require('../lib/firebase-admin');
const { applyCors, send } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return res.status(204).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return send(res, 500, { error: 'Razorpay secret is not configured' });
    const admin = getAdmin();
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return send(res, 401, { error: 'Google login required' });
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (!decoded.email_verified) return send(res, 403, { error: 'Verified Google account required' });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(x => typeof x === 'string' && x))
      return send(res, 400, { error: 'Missing Razorpay payment details' });

    const expected = crypto.createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(razorpay_signature, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
      return send(res, 400, { error: 'Payment signature verification failed' });

    const db = admin.firestore();
    const orderRef = db.collection('paymentOrders').doc(razorpay_order_id);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return send(res, 404, { error: 'Payment order not found' });
    const order = orderSnap.data();
    if (order.uid !== decoded.uid) return send(res, 403, { error: 'This order belongs to another user' });
    if (order.status === 'paid') return send(res, 200, { success: true, alreadyVerified: true });

    // Confirm Razorpay reports this payment as captured before granting access.
    const keyId = process.env.RAZORPAY_KEY_ID;
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${secret}`).toString('base64') }
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== razorpay_order_id || payment.status !== 'captured' || payment.amount !== order.amount)
      return send(res, 409, { error: 'Payment is not captured or amount does not match' });

    const userRef = db.collection('users').doc(decoded.uid);
    await db.runTransaction(async tx => {
      const freshOrder = await tx.get(orderRef);
      if (!freshOrder.exists) throw new Error('Order disappeared');
      if (freshOrder.data().status === 'paid') return;
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() : {};
      const subs = userData.subscriptionsByExam || {};
      const examSubs = subs[order.examKey] || { combo: false, topic: false, full: false, pdfs: {} };
      if (!examSubs.pdfs) examSubs.pdfs = {};
      if (order.itemType === 'pdf') examSubs.pdfs[String(order.itemId)] = true;
      else {
        const stateSnap = await tx.get(db.collection('appData').doc('main'));
        const exam = ((stateSnap.data() || {}).examDatabase || {})[order.examKey];
        const plan = (exam?.plans || []).find(x => String(x.id) === String(order.itemId));
        if (!plan) throw new Error('Purchased plan no longer exists');
        if (plan.category === 'combo') { examSubs.combo = true; examSubs.topic = true; examSubs.full = true; }
        else if (['topic', 'full'].includes(plan.category)) examSubs[plan.category] = true;
        else throw new Error('Unsupported plan category');
      }
      subs[order.examKey] = examSubs;
      tx.set(userRef, { subscriptionsByExam: subs, email: decoded.email || null }, { merge: true });
      tx.update(orderRef, { status: 'paid', paymentId: razorpay_payment_id, verifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    return send(res, 200, { success: true, message: 'Payment verified and course unlocked' });
  } catch (error) {
    console.error('verify-payment error:', error);
    return send(res, 500, { error: 'Could not verify payment' });
  }
};
