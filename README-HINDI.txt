TARGETRANK BACKEND - VERCEL + FIREBASE + RAZORPAY TEST MODE

GitHub repository ke root mein ye files/folders upload karein:
- api/create-order.js
- api/verify-payment.js
- firebase-admin.js
- package.json
- firestore.rules (Firebase Console > Firestore > Rules mein paste/publish karein; GitHub mein rakhna optional)

VERCEL Environment Variables (Production aur Preview jahan deploy karna ho):
1) RAZORPAY_KEY_ID = Razorpay Test Mode Key ID (rzp_test_...)
2) RAZORPAY_KEY_SECRET = usi Test Mode ka Secret (sirf Vercel server env; HTML mein kabhi nahi)
3) FIREBASE_SERVICE_ACCOUNT_JSON = Firebase service account ka poora JSON ek hi value mein

Firebase service account JSON: Firebase Console > Project settings > Service accounts > Generate new private key. Is JSON ko kisi ko share na karein aur GitHub par upload na karein.

Firestore Rules: firestore.rules ka content Firebase Console > Firestore Database > Rules mein paste karke Publish karein. IMPORTANT: is rule se Admin ko kaam karne ke liye Firebase Auth custom claim admin=true chahiye. Sirf frontend ADMIN_EMAILS check karna secure admin permission nahi hai. Custom claim abhi alag se set karna hoga.

Razorpay dashboard mein Test Mode enabled rakhein. Vercel env vars save karne ke baad redeploy karein.

NOTE: Backend product price ko appData/main.examDatabase se padhta hai. Plans ke category values `topic`, `full`, `combo` (ya unke actual category names) hone chahiye. PDF itemType `pdf` hai.
