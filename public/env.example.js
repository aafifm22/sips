// Contoh override konfigurasi lokal. Salin menjadi env.local.js (TIDAK di-commit,
// sudah di .gitignore) lalu isi bila perlu menunjuk project Firebase lain saat dev.
// Dipakai oleh firebase-config.js via window.__ENV. File env.local.js dimuat di index.html.
// window.__ENV = {
//   apiKey: '...',
//   authDomain: '...',
//   projectId: '...',
//   storageBucket: '...',
//   messagingSenderId: '...',
//   appId: '...',
//   REGION: 'asia-southeast2',
// };
window.__ENV = window.__ENV || null;
