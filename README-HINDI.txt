TARGETRANK BACKEND — VERCEL + FIREBASE + RAZORPAY
===================================================

GitHub repository ka sahi folder structure
-------------------------------------------
Target/
  index.html
  package.json
  README-HINDI.txt
  firestore.rules
  api/
    create-order.js
    verify-payment.js
  lib/
    firebase-admin.js
    http.js

IMPORTANT:
- firebase-admin.js ko ROOT mein mat rakhein. Iska sahi path lib/firebase-admin.js hai.
- http.js ka sahi path lib/http.js hai.
- firestore.rules file GitHub mein reference ke liye rahegi. Isko Firebase Console
  > Firestore Database > Rules mein alag se paste karke Publish karna hota hai.

Vercel Environment Variables
----------------------------
Vercel > Project > Settings > Environment Variables mein ye variables set karein:

1. RAZORPAY_KEY_ID
   Razorpay TEST mode ka Key ID (rzp_test_...).

2. RAZORPAY_KEY_SECRET
   Usi TEST mode Key ID ka matching Secret.
   Is secret ko index.html ya GitHub mein kabhi na daalein.

3. FIREBASE_SERVICE_ACCOUNT
   Firebase service-account JSON ka poora content ek hi environment-variable
   value mein paste karein. Is project ka lib/firebase-admin.js isi exact naam
   ko read karta hai.

4. FRONTEND_ORIGIN (optional)
   Allowed frontend origins comma-separated de sakte hain.
   lib/http.js mein GitHub Pages aur targetrank.vercel.app pehle se allowed hain.

Firebase service-account JSON kaise milega
------------------------------------------
Firebase Console > Project settings > Service accounts > Generate new private key.
JSON file ka poora content FIREBASE_SERVICE_ACCOUNT ki value mein paste karein.

SECURITY:
- Service-account JSON, private key aur Razorpay secret ko GitHub par upload na karein.
- In secrets ko kisi ke saath share na karein.
- Firebase Admin SDK Vercel backend mein hi rahega.

Firestore Rules aur Admin access
--------------------------------
firestore.rules mein Admin email index.html ke ADMIN_EMAILS se match honi chahiye.
Is repository mein configured admin email:
  769gopi@gmail.com

Rules verified Google account ke email aur email_verified claim ko check karte hain.
Admin password jo browser localStorage mein rakha gaya hai, Firestore Rules ka
security control nahi hai. Firestore authorization verified Google email se hoti hai.

Payment flow
------------
1. api/create-order.js authenticated user ke liye Razorpay order banata hai.
2. Order details Firestore ke paymentOrders collection mein server se save hoti hain.
3. api/verify-payment.js Razorpay signature aur captured payment verify karta hai.
4. Successful verification par backend users/{uid} mein subscriptionsByExam update karta hai.

IMPORTANT:
- Backend appData/main.examDatabase se plan/PDF price padhta hai.
- Paid plan categories: topic, full, combo.
- PDF itemType: pdf.
- Browser se bheji hui price par backend bharosa nahi karta.

Deployment
----------
GitHub par changes commit karne ke baad Vercel deployment complete hone dein.
Vercel environment variables add/change karne ke baad Production redeploy karein.
Pehle Razorpay TEST keys se hi test payment karein. Live keys tabhi use karein
jab test payment aur unlock flow sahi chal jaye.
