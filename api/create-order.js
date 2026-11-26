const Razorpay = require('razorpay');
const { getDb, authenticate } = require('../firebase-admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authenticate(req);
    const { examKey, itemType, itemId } = req.body || {};
    if (!examKey || !itemId || !['plan', 'pdf'].includes(itemType)) return res.status(400).json({ error: 'Invalid product details' });
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error('Razorpay server keys are not configured');
    const db = getDb();
    const stateSnap = await db.collection('appData').doc('main').get();
    if (!stateSnap.exists) return res.status(404).json({ error: 'Product catalogue is not configured' });
    const exam = (stateSnap.data().examDatabase || {})[String(examKey)];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const list = itemType === 'pdf' ? (exam.pdfs || []) : (exam.plans || []);
    const product = list.find(x => String(x.id) === String(itemId));
    if (!product) return res.status(404).json({ error: 'Paid item not found' });
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000) return res.status(400).json({ error: 'Invalid product price' });
    const amount = Math.round(price * 100);
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({ amount, currency: 'INR', receipt: `tr_${Date.now()}_${user.uid.slice(0, 8)}`, notes: { uid: user.uid, examKey: String(examKey), itemType, itemId: String(itemId) } });
    await db.collection('razorpayOrders').doc(order.id).set({ uid: user.uid, examKey: String(examKey), itemType, itemId: String(itemId), amount, currency: 'INR', status: 'created', createdAt: new Date() });
    return res.status(200).json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    console.error('create-order:', e);
    return res.status(e.status || 500).json({ error: e.status ? e.message : 'Could not create payment order' });
  }
};
