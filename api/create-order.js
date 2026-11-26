```javascript
const Razorpay = require("razorpay");
const { getDb, authenticate } = require("../lib/firebase-admin");

module.exports = async function handler(req, res) {
  // CORS / Preflight support
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Only POST method is allowed"
    });
  }

  try {
    const user = await authenticate(req);

    if (!user || !user.uid) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    const { examKey, itemType, itemId } = req.body || {};

    if (
      !examKey ||
      !itemId ||
      !["plan", "pdf"].includes(itemType)
    ) {
      return res.status(400).json({
        error: "Invalid product details"
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error("Razorpay server keys are not configured");
    }

    const db = getDb();

    const stateSnap = await db
      .collection("appData")
      .doc("main")
      .get();

    if (!stateSnap.exists) {
      return res.status(404).json({
        error: "Product catalogue is not configured"
      });
    }

    const examDatabase =
      stateSnap.data().examDatabase || {};

    const exam = examDatabase[String(examKey)];

    if (!exam) {
      return res.status(404).json({
        error: "Exam not found"
      });
    }

    const list =
      itemType === "pdf"
        ? exam.pdfs || []
        : exam.plans || [];

    const product = list.find(
      (x) => String(x.id) === String(itemId)
    );

    if (!product) {
      return res.status(404).json({
        error: "Paid item not found"
      });
    }

    const price = Number(product.price);

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 100000
    ) {
      return res.status(400).json({
        error: "Invalid product price"
      });
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

    await db
      .collection("razorpayOrders")
      .doc(order.id)
      .set({
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
      success: false,
      error: error.status
        ? error.message
        : "Could not create payment order"
    });
  }
};
```
