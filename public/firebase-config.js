// Salin nilai dari: Firebase Console > Project settings > Your apps > Web app > Config
// Override lokal (dev): salin public/env.example.js menjadi public/env.local.js (gitignored)
// yang mengisi window.__ENV sebelum modul ini dimuat.
const ENV = (typeof window !== 'undefined' && window.__ENV) || {};
export const firebaseConfig = {
  apiKey: ENV.apiKey || 'AIzaSyDE-Jg_uOy7cYHtafKTKnG1iSaj914mP4w',
  authDomain: ENV.authDomain || 'sips-yky.firebaseapp.com',
  projectId: ENV.projectId || 'sips-yky',
  storageBucket: ENV.storageBucket || 'sips-yky.firebasestorage.app',
  messagingSenderId: ENV.messagingSenderId || '1088495846958',
  appId: ENV.appId || '1:1088495846958:web:00cd20859980a295b981bf',
};
// Harus sama dengan region Cloud Functions (functions/index.js)
export const REGION = ENV.REGION || 'asia-southeast2';
