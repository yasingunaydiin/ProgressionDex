// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDveqAm--G7myjTrssw9p4QHpVtyNzjruQ",
  authDomain: "progression-dex.firebaseapp.com",
  projectId: "progression-dex",
  storageBucket: "progression-dex.appspot.com",
  messagingSenderId: "17776985941",
  appId: "1:17776985941:web:b393e1e5daa3d88a2c51dc",
  measurementId: "G-JDKE9D26GK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Variables
const auth = firebase.auth()
const database = firebase.database()

// Set up our register function
function register () {
  email = document.getElementById('email').value
  password = document.getElementById('password').value
  email = document.getElementById('email').value
}