// Salin nilai dari: Firebase Console > Project settings > Your apps > Web app > Config
export const firebaseConfig = {
  apiKey: 'ISI_API_KEY',
  authDomain: 'PROJECT-ID.firebaseapp.com',
  projectId: 'PROJECT-ID',
  storageBucket: 'PROJECT-ID.firebasestorage.app',
  messagingSenderId: 'ISI',
  appId: 'ISI',
};
// Harus sama dengan region Cloud Functions (functions/index.js)
export const REGION = 'asia-southeast2';
