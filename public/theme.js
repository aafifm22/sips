import { S, fs, modal } from './core.js';
import { doc, updateDoc } from 'firebase/firestore';
const A = (window.A = window.A || {});
export const PAL = { indigo: '#4f46e5', emerald: '#059669', rose: '#e11d48', amber: '#d97706', ocean: '#0284c7', violet: '#7c3aed', teal: '#0d9488', pink: '#db2777', slate: '#475569' };
const hexOf = (a) => (String(a).startsWith('#') ? a : PAL[a] || PAL.indigo);
export function pref() {
  const p = S.p || {}, l = JSON.parse(localStorage.getItem('ly-theme') || '{}');
  return { theme: l.theme || p.theme || 'auto', accent: l.accent || p.accent || S.set.accent || 'indigo', colorful: l.colorful ?? p.colorful ?? S.set.colorful ?? false };
}
export function applyTheme() {
  const t = pref(), r = document.documentElement;
  r.dataset.theme = t.theme === 'auto' ? '' : t.theme; r.style.setProperty('--pr', hexOf(t.accent)); document.body.classList.toggle('colorful', !!t.colorful);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', hexOf(t.accent));
}
function themeM() {
  const t = pref();
  modal(`<h2>🎨 Tema & warna</h2><label>Mode</label><div class="row">${[['auto', 'Otomatis'], ['light', 'Terang'], ['dark', 'Gelap']].map(([v, l]) => `<button class="btn ${t.theme === v ? '' : 'g'} s" onclick="A.setTheme({theme:'${v}'})">${l}</button>`).join('')}</div>
  <label style="display:block;margin-top:10px">Warna aksen</label><div class="row">${Object.entries(PAL).map(([k, c]) => `<button title="${k}" onclick="A.setTheme({accent:'${k}'})" style="width:34px;height:34px;border-radius:50%;border:${t.accent === k ? '3px solid var(--tx)' : '2px solid var(--bd)'};background:${c};cursor:pointer"></button>`).join('')}<input type="color" value="${hexOf(t.accent)}" onchange="A.setTheme({accent:this.value})" style="width:44px;height:34px;padding:0;margin:0"></div>
  <label class="chk" style="margin-top:12px"><input type="checkbox" ${t.colorful ? 'checked' : ''} onchange="A.setTheme({colorful:this.checked})">Mode warna-warni (header gradien, kartu statistik berwarna)</label><br><button class="btn g s" onclick="A.close()">Selesai</button>`);
}
Object.assign(A, {
  themeM,
  async setTheme(v) {
    localStorage.setItem('ly-theme', JSON.stringify({ ...JSON.parse(localStorage.getItem('ly-theme') || '{}'), ...v }));
    applyTheme(); themeM();
    if (S.user && S.p) updateDoc(doc(fs, 'users', S.user.uid), v).catch(() => {});
  },
});
