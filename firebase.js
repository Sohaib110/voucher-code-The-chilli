// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBfCbJwGifK6_UIPU0srJ4L83axtaTOa_Y",
  authDomain: "vouchercode-green-chilli.firebaseapp.com",
  projectId: "vouchercode-green-chilli",
  storageBucket: "vouchercode-green-chilli.firebasestorage.app",
  messagingSenderId: "821928092825",
  appId: "1:821928092825:web:5106170b936fec3a82c408",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
export { db };
