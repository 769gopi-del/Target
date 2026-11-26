const Razorpay = require("razorpay");
const { getDb, authenticate } = require("../lib/firebase-admin");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await authenticate(req);

    const { examKey, itemType, itemId } = req.body || {};

    if (!examKey || !itemId || !["plan", "pdf"].includes(itemType)) {
      return res.status(400).json({ error: "Invalid product details" });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error("Razorpay Environment Variables missing");
    }

    const db = getDb();

    const stateSnap = await db.collection("appData").doc("main").get();

    if (!stateSnap.exists) {
      return res.status(404).json({ error: "Product catalogue not found" });
    }

    const exam = (stateSnap.data().examDatabase || {})[String(examKey)];

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const products = itemType === "pdf"
      ? (exam.pdfs || [])
      : (exam.plans || []);

    const product = products.find(
      p => String(p.id) === String(itemId)
    );

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const price = Number(product.price);

    if (!Number.isFinite(price) || price <= 0 || price > 100000) {
      return res.status(400).json({ error: "Invalid product price" });
    }

    const amount = Math.round(price * 100);

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `tr_${Date.now()}_${user.uid.slice(0, 8)}`,
      notes: {
        uid: user.uid,
        examKey: String(examKey),
        itemType,
        itemId: String(itemId)
      }
    });

    await db.collection("razorpayOrders").doc(order.id).set({
      uid: user.uid,
      examKey: String(examKey),
      itemType,
      itemId: String(itemId),
      amount,
      currency: "INR",
      status: "created",
      createdAt: new Date()
    });

    return res.status(200).json({
      success: true,
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    return res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : "Could not create Razorpay order"
    });
  }
};
