TARGETRANK - VERCEL PAYMENT BACKEND

Is folder ko apne GitHub repository Target ke ROOT me upload/merge karna hai.
Final structure:
  api/create-order.js
  api/verify-payment.js
  lib/firebase-admin.js
  package.json

Vercel Environment Variables (Project Settings > Environment Variables):
1) RAZORPAY_KEY_ID = Razorpay TEST mode ka Key ID (rzp_test_...)
2) RAZORPAY_KEY_SECRET = usi TEST key pair ka Secret
3) FIREBASE_SERVICE_ACCOUNT = Firebase service-account JSON ka poora content, ek hi value me

Firebase service account banane ke liye Firebase Console > Project settings > Service accounts > Generate new private key. JSON file ko kisi ko share na karein. JSON ka poora text FIREBASE_SERVICE_ACCOUNT ki VALUE me paste karein. Is JSON ko GitHub me upload NA karein.

IMPORTANT:
- Razorpay Secret aur Firebase service-account private key kabhi HTML/GitHub me nahi jayengi.
- Vercel environment variables set karne ke baad redeploy zaroori hota hai.
- Frontend HTML abhi in APIs se connected nahi hai. API files upload karna akela payment flow ko active nahi karega; HTML me checkout integration ka agla update bhi zaroori hai.
- Backend order create karne se pehle Firestore appData/main me admin ka latest examDatabase save hona chahiye.
- Abhi API supported purchases: admin-created plans (topic/full/combo) aur PDFs. Fixed-price one-off topic/full buttons ko agle frontend integration me proper plan IDs se map karna hoga.
- Test mode me test Key ID + matching Test Secret hi use karein. Live keys ko test secret ke saath mix na karein.
