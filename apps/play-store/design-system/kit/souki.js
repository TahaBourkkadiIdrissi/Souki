/* SOUKI Android : kit des écrans (icônes Lucide, données d'exemple, cadre de téléphone, composants). */
(function () {
  const PH = '../../assets/Photos/', IL = '../../assets/Illustrations/';
  const BLOB = { splash: '/_blob/0b53cf425c8e83f8a5a2282baf9cee15', symbol: '/_blob/60fbc2d104b309d3f604a56617ccfb4a', logo: '/_blob/eeb6272f4a232daa32ba46b47868d9a1' };
  const IC = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    list: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    plus: '<path d="M5 12h14M12 5v14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    mic: '<path d="M12 19v3M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    right: '<path d="M5 12h14M12 5l7 7-7 7"/>', back: '<path d="M19 12H5M12 19l-7-7 7-7"/>', chev: '<path d="m9 18 6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    spark: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
    sort: '<path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    apple: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
    carrot: '<path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    locate: '<path d="M2 12h3M19 12h3M12 2v3M12 19v3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
    wifioff: '<path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 5.17-2.7M19 12.86a10 10 0 0 0-2.01-1.52M2 8.82a15 15 0 0 1 4.18-2.64M22 8.82a15 15 0 0 0-11.29-3.76M2 2l20 20"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    call: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01"/>',
    sig: '<path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>', bat: '<rect x="2" y="7" width="16" height="10" rx="2"/><path d="M22 11v2"/><rect x="4.5" y="9.5" width="9" height="5" rx=".5" fill="currentColor" stroke="none"/>',
  };
  const i = (n, s = 24, c = '') => `<svg class="i ${c}" width="${s}" height="${s}" viewBox="0 0 24 24">${IC[n]}</svg>`;
  // Exemples réalistes, clairement fictifs : l'app affichera les données de l'API.
  const P = {}; [
    ['tomate', 'Tomate', 'Mtecha', 'ماطيشة', 3.5, 'kg'], ['pomme-de-terre', 'Pomme de terre', 'Btata', 'بطاطا', 4, 'kg'], ['oignon', 'Oignon', 'Bsla', 'بصلة', 4.5, 'kg'],
    ['carotte', 'Carotte', 'Khizzou', 'خيزو', 5, 'kg'], ['courgette', 'Courgette', 'Gar3a', 'قرعة', 6, 'kg'], ['aubergine', 'Aubergine', 'Denjal', 'دنجال', 6.5, 'kg'],
    ['concombre', 'Concombre', 'Khyar', 'خيار', 5.5, 'kg'], ['poivron-vert', 'Poivron vert', 'Felfla khadra', 'فلفلة خضرا', 8, 'kg'], ['poivron-rouge', 'Poivron rouge', 'Felfla hamra', 'فلفلة حمرا', 12, 'kg'],
    ['poivron-jaune', 'Poivron jaune', 'Felfla sefra', 'فلفلة صفرا', 14, 'kg'], ['piment', 'Piment', 'Felfla harra', 'فلفلة حارة', 10, 'kg'], ['ail', 'Ail', 'Touma', 'تومة', 28, 'kg'],
    ['betterave', 'Betterave', 'Barba', 'باربا', 5, 'kg'], ['navet', 'Navet', 'Left', 'لفت', 4.5, 'kg'], ['chou', 'Chou', 'Kromb', 'كرنب', 6, 'pièce'],
    ['chou-fleur', 'Chou-fleur', 'Chiflor', 'شيفلور', 9, 'pièce'], ['brocoli', 'Brocoli', 'Brokoli', 'بروكولي', 14, 'pièce'], ['laitue', 'Laitue', 'Khoss', 'خس', 4, 'pièce'],
    ['epinard', 'Épinard', 'Sbanekh', 'سبانخ', 5, 'botte'], ['petit-pois', 'Petit pois', 'Jelbana', 'جلبانة', 12, 'kg'], ['haricot-vert', 'Haricot vert', 'Loubia', 'لوبيا خضرا', 13, 'kg'],
    ['radis', 'Radis', 'Fjel', 'فجل', 3, 'botte'], ['celeri', 'Céleri', 'Krafes', 'كرافس', 3, 'botte'], ['fenouil', 'Fenouil', 'Besbas', 'بسباس', 7, 'kg'],
    ['potiron', 'Potiron', 'Gar3a hamra', 'قرعة حمرا', 5, 'kg'], ['patate-douce', 'Patate douce', 'Btata hlouwa', 'بطاطا حلوة', 9, 'kg'], ['gingembre', 'Gingembre', 'Skinjbir', 'سكينجبير', 45, 'kg'],
    ['mais', 'Maïs', 'Dra', 'ذرة', 4, 'pièce'], ['poireau', 'Poireau', 'Borro', 'بورو', 8, 'kg'], ['roquette', 'Roquette', 'Jarjir', 'جرجير', 4, 'botte'],
    ['chou-de-bruxelles', 'Chou de Bruxelles', 'Kromb sghir', 'كرنب صغير', 18, 'kg'], ['rutabaga', 'Rutabaga', 'Left sfer', 'لفت أصفر', 6, 'kg'],
  ].forEach(([id, fr, dj, ar, price, unit]) => P[id] = { id, fr, dj, ar, price, unit, img: PH + id + '.png' });
  let lang = 'fr';
  const L = (fr, ar) => lang === 'ar' ? ar : fr;
  const dh = v => v.toFixed(2).replace('.', ',');
  const price = (v, unit, cls = '') => `<span class="pr num ${cls}"><b>${dh(v)}</b><small>DH${unit ? ' / ' + unit : ''}</small></span>`;
  const name = p => L(p.fr, p.ar), sub = p => L(p.dj + ' · ' + p.ar, p.dj + ' · ' + p.fr);
  const qty = (label, cls = '') => `<div class="qty ${cls}"><span>${i('minus', 20)}</span><b class="num">${label}</b><span>${i('plus', 20)}</span></div>`;
  function card(id, st = {}) {
    const p = P[id];
    const pill = st.out ? `<span class="pill gone">${L('Épuisé', 'نفد')}</span>` : st.low ? `<span class="pill">${L('Bientôt épuisé', 'قرب ينفد')}</span>` : '';
    return `<div class="pc ${st.qty ? 'in' : ''} ${st.out ? 'out' : ''}"><span class="pic"><img src="${p.img}" alt="">${pill}</span><h3>${name(p)}</h3><p class="sm soft2">${sub(p)}</p>
${st.qty || st.out ? '' : `<span class="ib">${i('plus', 20)}</span>`}<div class="foot">${st.qty ? '' : price(p.price, p.unit)}</div>${st.qty ? qty(st.qty) : ''}</div>`;
  }
  const ab = (title, trail = '') => `<div class="ab"><span class="ib ghost">${i('back', 24, 'flip')}</span><h2>${title}</h2>${trail}</div>`;
  /** Champ contour M3. o: {v, ph, icon, trail, err, help, focus} */
  const field = (label, o = {}) => `<div class="fld ${o.err ? 'err' : ''} ${o.focus ? 'foc' : ''}"><label>${label}</label><div class="box">${o.icon ? i(o.icon, 20) : ''}<span class="${o.v ? '' : 'phd'}${o.num ? ' num' : ''}">${o.v || o.ph || ''}</span>${o.focus ? '<i class="caret"></i>' : ''}${o.trail ? `<span class="tr">${i(o.trail, 20)}</span>` : ''}</div>${o.err || o.help ? `<p>${o.err || o.help}</p>` : ''}</div>`;
  const sw = on => `<span class="sw ${on ? 'on' : ''}"><i></i></span>`;
  const radio = on => `<span class="rd ${on ? 'on' : ''}"></span>`;
  /** Ligne de liste. trail: html (chevron par défaut) */
  const row = (icon, title, sub = '', trail) => `<div class="li">${icon ? i(icon, 22) : ''}<div class="mid"><p class="t16">${title}</p>${sub ? `<p class="sm soft2">${sub}</p>` : ''}</div>${trail === undefined ? i('chev', 20, 'flip soft2') : trail}</div>`;
  const grp = (title, rows) => `${title ? `<p class="gt">${title}</p>` : ''}<div class="grp">${rows.join('')}</div>`;
  const snack = (t, a) => `<div class="snack"><span>${t}</span>${a ? `<b>${a}</b>` : ''}</div>`;
  const fab = (label) => `<div class="fab">${i('mic', 22)}${label || ''}</div>`;
  /** La route en « S » de l'onboarding : le camion avance d'étape en étape. */
  const road = (step, total) => { const x = 16 + (296 * (step - 1)) / (total - 1), y = 20 + 10 * Math.sin(((x - 16) / 296) * Math.PI * 2);
    return `<svg class="road" viewBox="0 0 328 40" width="328" height="40"><path class="rt" d="M16 20C65 -5 115 -5 164 20S263 45 312 20"/><path class="rp" pathLength="100" stroke-dasharray="${((step - 1) / (total - 1)) * 100} 100" d="M16 20C65 -5 115 -5 164 20S263 45 312 20"/><g transform="translate(${x - 14} ${y - 14})"><rect class="rk" width="28" height="28" rx="8"/><g transform="translate(5 5) scale(.75)" class="i ri">${IC.truck}</g></g></svg>`; };
  /** Carte stylisée (Google Maps dans l'app). o: {out, h} */
  const map = (o = {}) => `<div class="map" style="height:${o.h || 300}px"><svg viewBox="0 0 360 300" preserveAspectRatio="xMidYMid slice"><path class="rd1" d="M-10 80C90 60 150 130 370 90M-10 210C120 190 220 250 370 220M70-10C60 100 120 200 90 310M250-10C270 90 230 190 280 310"/><path class="rd2" d="M-10 150H370M170-10V310M-10 30L370 270"/><circle class="zn" cx="${o.out ? 90 : 180}" cy="${o.out ? 110 : 150}" r="${o.out ? 80 : 120}"/></svg><span class="pinm ${o.out ? 'out' : ''}">${i('pin', 40)}</span><span class="ib surf loc">${i('locate', 22)}</span></div>`;
  const TONE = { wait: 'clock', road: 'truck', ok: 'check', issue: 'alert' };
  const tone = (t, label) => `<span class="tone ${t}">${i(TONE[t], 16)}${label}</span>`;
  /** Les 4 étapes de commande le long du « S ». cur: 0..3 ; times: libellés d'heure ; issue: étape en incident */
  const steps = (cur, times = [], issue) => { const T = [['Commande confirmée', 'تم تأكيد الطلب'], ['Préparation', 'التحضير'], ['En livraison', 'في الطريق'], ['Livrée', 'تم التوصيل']];
    const X = n => (n % 2 ? 44 : 16), d = T.map((_, n) => n ? `C${X(n - 1)} ${n * 64 - 14} ${X(n)} ${n * 64 - 22} ${X(n)} ${n * 64 + 14}` : `M16 14`).join('');
    return `<div class="stp"><svg width="60" height="${T.length * 64 - 36}" viewBox="0 0 60 ${T.length * 64 - 36}"><path class="rt" d="${d}"/><path class="rp" pathLength="3" stroke-dasharray="${cur} 3" d="${d}"/>${T.map((_, n) => `<circle class="${n < cur ? 'dn' : n === cur ? (issue ? 'is' : 'nw') : 'td'}" cx="${X(n)}" cy="${n * 64 + 14}" r="${n === cur ? 10 : 8}"/>`).join('')}</svg><div>${T.map((t, n) => `<div class="${n > cur ? 'soft2' : ''}"><p class="t16">${L(t[0], t[1])}</p><p class="sm soft2 num" style="text-align:start">${times[n] || ''}</p></div>`).join('')}</div></div>`; };
  const line = (k, sub, trail = '', cls = '') => `<div class="line ${cls}"><span class="pic"><img src="${P[k].img}" alt=""></span><div class="mid"><p class="t16">${name(P[k])}</p><p class="sm soft2">${sub}</p></div>${trail}</div>`;
  const sheet = html => `<div class="scrim"></div><div class="sheet"><i class="grab"></i>${html}<div class="gest"></div></div>`;
  const dialog = (title, body, no, yes, danger) => `<div class="scrim"></div><div class="dlg"><p class="h2">${title}</p><p class="soft2" style="margin-top:12px">${body}</p><div class="row" style="justify-content:flex-end;margin-top:20px"><span class="btn text md">${no}</span><span class="btn text md" style="${danger ? 'color:var(--error)' : ''}">${yes}</span></div></div>`;
  const tabs = (items, on = 0) => `<div class="tabs">${items.map((t, n) => `<span class="${n === on ? 'on' : ''}">${t}</span>`).join('')}</div>`;
  const cb = on => `<span class="cb ${on ? 'on' : ''}">${on ? i('check', 16) : ''}</span>`;
  const NAV = [['home', 'Accueil', 'الرئيسية'], ['grid', 'Produits', 'المنتجات'], ['bag', 'Panier', 'السلة'], ['list', 'Commandes', 'الطلبات'], ['user', 'Compte', 'حسابي']];
  /** o: {theme, lang, tab, cart:{n,total}, bar, sb:'#fff', cap} ; body: () => html */
  function phone(o, body) {
    lang = o.lang || 'fr';
    const nav = o.tab == null ? '' : `<div class="nav">${NAV.map(([k, f, a], n) => `<a class="${n === o.tab ? 'on' : ''}"><i>${i(k, 22)}${k === 'bag' && o.cart ? `<em>${o.cart.n}</em>` : ''}</i>${L(f, a)}</a>`).join('')}</div>`;
    const cart = o.cart && o.tab !== 2 ? `<div class="cart"><span class="n num">${o.cart.n}</span>${L('Voir le panier', 'عرض السلة')}<span class="t">${price(o.cart.total, '', 'inh')}</span></div>` : '';
    return `<div class="col"><div class="cap">${o.cap || ''}</div><div class="ph" style="width:${o.w || 360}px;height:${o.h || 800}px;--fs:${o.fs || 1};--fl:${1 + ((o.fs || 1) - 1) / 2}" data-theme="${o.theme || 'light'}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}" lang="${lang}">
<div class="sb" style="color:${o.sb || 'var(--on-surface)'}"><span>9:41</span><span>${i('sig', 15)}${i('bat', 20)}</span></div>
<div class="sc" style="${o.full ? 'padding:0' : ''}">${body()}</div>
${o.modal ? o.modal() : ''}${o.full ? '' : `<div class="bot ${o.bar ? 'plain' : ''}">${typeof o.over === 'function' ? o.over() : o.over || ''}${cart}${typeof o.bar === 'function' ? o.bar() : o.bar || ''}${nav}<div class="gest"></div></div>`}</div></div>`;
  }
  window.SK = { tone, steps, line, sheet, dialog, tabs, cb, ab, field, sw, radio, row, grp, snack, fab, road, map, P, i, L, dh, price, name, sub, qty, card, phone, IL, PH, BLOB, show: h => document.body.insertAdjacentHTML('beforeend', h) };
})();
