import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB0zEMNlZwKaJql5B2IWs3GB0iA6XHJxSM",
  authDomain: "sbcapitalco-b8b94.firebaseapp.com",
  projectId: "sbcapitalco-b8b94",
  storageBucket: "sbcapitalco-b8b94.firebasestorage.app",
  messagingSenderId: "612261570622",
  appId: "1:612261570622:web:92454b7811921b93c6096f",
  measurementId: "G-Q9ZY4K60K3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;