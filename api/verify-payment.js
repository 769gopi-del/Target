const crypto = require("crypto");
const { getDb, authenticate } = require("../lib/firebase-admin");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const user = await authenticate(req);

    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    } = req.body || {};

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        error: "Payment details incomplete"
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !secret) {
      throw new Error("Razorpay credentials missing");
    }

    // Verify Razorpay signature
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return res.status(400).json({
        error: "Invalid payment signature"
      });
    }

    const db = getDb();

    const orderRef = db.collection("razorpayOrders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderSnap.data();

    if (order.uid !== user.uid) {
      return res.status(403).json({ error: "Unauthorized order" });
    }

    if (order.status === "paid") {
      return res.status(200).json({
        success: true,
        alreadyProcessed: true
      });
    }

    // Verify payment directly with Razorpay
    const auth = Buffer.from(`${keyId}:${secret}`).toString("base64");

    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      throw new Error("Razorpay payment verification failed");
    }

    if (
      payment.order_id !== orderId ||
      payment.amount !== order.amount ||
      payment.currency !== order.currency
    ) {
      return res.status(400).json({
        error: "Payment details do not match"
      });
    }

    // Capture payment if Razorpay reports authorized status
    let finalPayment = payment;

    if (payment.status === "authorized") {
      const captureResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            amount: order.amount,
            currency: order.currency
          })
        }
      );

      finalPayment = await captureResponse.json();

      if (!captureResponse.ok) {
        throw new Error("Payment capture failed");
      }
    }

    if (finalPayment.status !== "captured") {
      return res.status(400).json({
        error: "Payment has not been captured"
      });
    }

    const userRef = db.collection("users").doc(user.uid);

    await db.runTransaction(async tx => {

      const freshOrder = await tx.get(orderRef);

      if (!freshOrder.exists) {
        throw new Error("Order not found");
      }

      if (freshOrder.data().status === "paid") {
        return;
      }

      const userSnap = await tx.get(userRef);

      const userData = userSnap.exists
        ? userSnap.data()
        : {};

      const allSubs = userData.subscriptionsByExam || {};

      const sub = allSubs[order.examKey] || {
        combo: false,
        topic: false,
        full: false,
        pdfs: {}
      };

      sub.pdfs = sub.pdfs || {};

      if (order.itemType === "pdf") {
        sub.pdfs[String(order.itemId)] = true;
      } else {

        const stateSnap = await tx.get(
          db.collection("appData").doc("main")
        );

        const exam = (
          ((stateSnap.data() || {}).examDatabase || {})
        )[order.examKey] || {};

        const plan = (exam.plans || []).find(
          p => String(p.id) === String(order.itemId)
        );

        if (!plan) {
          throw new Error("Purchased plan not found");
        }

        const category = String(plan.category || "").toLowerCase();

        if (category === "combo") {
          sub.combo = true;
          sub.topic = true;
          sub.full = true;
        } else if (["topic", "full"].includes(category)) {
          sub[category] = true;
        } else {
          sub[category] = true;
        }
      }

      allSubs[order.examKey] = sub;

      tx.set(userRef, {
        subscriptionsByExam: allSubs,
        updatedAt: new Date()
      }, { merge: true });

      tx.set(orderRef, {
        status: "paid",
        paymentId,
        paidAt: new Date()
      }, { merge: true });

      tx.set(
        db.collection("payments").doc(paymentId),
        {
          uid: user.uid,
          orderId,
          amount: order.amount,
          currency: order.currency,
          examKey: order.examKey,
          itemType: order.itemType,
          itemId: order.itemId,
          status: "captured",
          createdAt: new Date()
        }
      );
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified and content unlocked"
    });

  } catch (error) {
    console.error("VERIFY PAYMENT ERROR:", error);

    return res.status(error.status || 500).json({
      error: error.status
        ? error.message
        : (error.message || "Payment verification failed")
    });
  }
};
