import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDVrs7EO6yxzMWskM_RaZ8RG47dgxA1f4Y",
  authDomain: "hopeful-cubist-429007-j9.firebaseapp.com",
  projectId: "hopeful-cubist-429007-j9",
  storageBucket: "hopeful-cubist-429007-j9.firebasestorage.app",
  messagingSenderId: "93914681297",
  appId: "1:93914681297:web:9778943d735319f4991af0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-126f2493-2814-4721-98b1-985214fd4510");

