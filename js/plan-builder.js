(function() {
'use strict';

/* ─── Constants ─────────────────────────────── */
const STORAGE_KEY = 'jst_plan_v1';
const MAX_DAY_MIN = 780;         // 13 active hours per day (09:00–22:00)
const FULL_DAY_TRAVEL_MIN = 360; // flight or journey ≥ this = dedicated travel day
const START_HOUR  = 9;           // day starts 09:00

const CAT_COLOR = {
  sightseeing: '#1a45a8',
  gourmet:     '#D64000',
  nature:      '#1a7a34',
  leisure:     '#b35c00',
  events:      '#b5006e',
};
const CAT_ICON = {
  sightseeing: '⛩️',
  gourmet:     '🍜',
  nature:      '🏔️',
  leisure:     '🎭',
  events:      '🎆',
};

/* ─── State ─────────────────────────────────── */
let allSpots   = [];   // flat array of all spots
let planCart   = loadCart();  // Map<id, spot>

/* ─── Utility ───────────────────────────────── */
function loadCart() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return new Map();
    // Handle both storage formats:
    // Old: [[id, spotObj], ...]  (Map-entries array saved by older code)
    // New: [spotObj, ...]        (plain array saved by current code)
    if (Array.isArray(arr[0])) {
      return new Map(arr); // old format → straight to Map constructor
    } else {
      return new Map(arr.map(function(s){ return [s.id, s]; })); // new format
    }
  } catch(e) { return new Map(); }
}
function saveCart() {
  // Store as plain array of spot objects — no Map-entry nesting
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...planCart.values()]));
}

function fmtYen(n) {
  if (!n || n === 0) return 'Free';
  return '¥' + n.toLocaleString();
}
function fmtYenNum(n) {
  if (!n || n === 0) return 'Free';
  return '¥' + n.toLocaleString() + '/person';
}
function fmtDur(min) {
  if (min < 60) return min + 'min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + 'h' + (m ? ' ' + m + 'm' : '');
}
function fmtReviews(n) {
  if (n >= 10000) return Math.round(n / 1000) + 'K reviews';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K reviews';
  return n + ' reviews';
}
function fmtTime(totalMin) {
  const h = START_HOUR + Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
}

/* ─── Stars ─────────────────────────────────── */
function renderStars(rating) {
  if (!rating) return '';
  let s = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i)       s += '★';
    else if (rating >= i - 0.5) s += '⭑';
    else                   s += '☆';
  }
  return s;
}

/* ─── Popularity badge ──────────────────────── */
function popBadge(reviewCount) {
  if (!reviewCount) return '';
  let cls, label;
  if (reviewCount >= 50000) { cls = 'pb-pop-high';  label = '🔥 Very Popular'; }
  else if (reviewCount >= 20000) { cls = 'pb-pop-med'; label = '⭐ Popular'; }
  else if (reviewCount >= 5000)  { cls = 'pb-pop-low'; label = '👍 Well-known'; }
  else                           { cls = 'pb-pop-niche'; label = '💎 Niche'; }
  return `<span class="pb-pop-badge ${cls}">${label}</span>`;
}

/* ─── Prefecture centre coordinates (fallback when spot has no lat/lng) ── */
const PREF_CENTER = {
  hokkaido:  [43.06, 141.35], aomori:    [40.82, 140.74],
  iwate:     [39.70, 141.15], miyagi:    [38.27, 140.87],
  akita:     [39.72, 140.10], yamagata:  [38.24, 140.36],
  fukushima: [37.75, 140.47], ibaraki:   [36.34, 140.45],
  tochigi:   [36.57, 139.88], gunma:     [36.39, 139.06],
  saitama:   [35.86, 139.65], chiba:     [35.61, 140.12],
  tokyo:     [35.69, 139.69], kanagawa:  [35.45, 139.64],
  niigata:   [37.90, 139.02], toyama:    [36.70, 137.21],
  ishikawa:  [36.59, 136.63], yamanashi: [35.66, 138.57],
  nagano:    [36.65, 138.18], shizuoka:  [34.98, 138.38],
  aichi:     [35.18, 136.91], mie:       [34.73, 136.51],
  shiga:     [35.00, 135.87], kyoto:     [35.02, 135.76],
  osaka:     [34.69, 135.50], nara:      [34.69, 135.83],
  hyogo:     [34.69, 135.20], wakayama:  [34.23, 135.17],
  tottori:   [35.50, 134.24], shimane:   [35.47, 133.05],
  okayama:   [34.66, 133.93], hiroshima: [34.40, 132.46],
  yamaguchi: [34.19, 131.47], tokushima: [34.07, 134.56],
  kagawa:    [34.34, 134.04], ehime:     [33.84, 132.77],
  kochi:     [33.56, 133.53], fukuoka:   [33.61, 130.42],
  saga:      [33.26, 130.30], nagasaki:  [32.74, 129.87],
  kumamoto:  [32.79, 130.74], oita:      [33.24, 131.61],
  miyazaki:  [31.91, 131.42], kagoshima: [31.60, 130.56],
  okinawa:   [26.21, 127.68]
};

/* ─── Spot field helpers (handle missing data gracefully) ── */
function spotLat(s) { return s.lat || (PREF_CENTER[s._pref] || [35.69])[0]; }
function spotLng(s) { return s.lng || (PREF_CENTER[s._pref] || [35.69, 139.69])[1]; }
function spotArea(s) {
  return s.area || (PREF_LABEL[s._pref] ? PREF_LABEL[s._pref] : (s._pref || ''));
}
// True only when the spot has a real named area (not a pref-label fallback)
function hasRealArea(s) { return !!(s.area && s.area.trim()); }
function spotLocation(s) {
  if (s.location) return s.location;
  const area = s.area ? s.area.charAt(0).toUpperCase() + s.area.slice(1) + ', ' : '';
  return area + (PREF_LABEL[s._pref] || s._pref || '');
}

/* ─── Distance (Haversine, km) ──────────────── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2
          + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function spotDist(a, b) {
  return haversine(spotLat(a), spotLng(a), spotLat(b), spotLng(b));
}

/* ─── Flight / long-distance detection ──────── */
// Okinawa has no rail link to mainland → always fly (when crossing prefectures).
// Other cross-prefecture routes > 800 km also require a flight.
function needsFlight(a, b) {
  const pa = a._pref || '', pb = b._pref || '';
  if (pa === pb) return false;  // same prefecture never needs a flight
  if (pa === 'okinawa' || pb === 'okinawa') return true;
  return spotDist(a, b) > 800;
}

/* ─── Travel time (minutes) ─────────────────── */
function travelMin(a, b) {
  // Only use the "15 min walk" shortcut when both spots have a real named area
  if (hasRealArea(a) && hasRealArea(b) && a.area === b.area && a._pref === b._pref) return 15;
  if (needsFlight(a, b)) return 240;  // ~4h door-to-door domestic flight
  // Same prefecture but no precise coords → reasonable default
  if (a._pref && a._pref === b._pref) return 30;
  const dist = spotDist(a, b);
  if (dist < 0.8)  return 10;   // walk
  if (dist < 3)    return 20;   // metro 1-2 stops
  if (dist < 8)    return 30;   // metro / bus
  if (dist < 20)   return 45;   // local train
  if (dist < 50)   return 70;   // express train
  if (dist < 100)  return 120;  // limited express
  if (dist < 300)  return 180;  // Shinkansen
  return 250;                   // long Shinkansen
}

/* ─── Route travel-time table (minutes, door-to-door realistic) ── */
// Key = sorted "prefA:prefB". Covers major tourist routes.
// Flights are handled by needsFlight(); this table is for Shinkansen / train routes.
const ROUTE_TABLE = {
  // ── Kanto local ──────────────────────────────────────
  'chiba:tokyo':          40,
  'kanagawa:tokyo':       30,
  'saitama:tokyo':        35,
  'gunma:tokyo':          55,
  'ibaraki:tokyo':        60,
  'tochigi:tokyo':        55,
  // ── Tokyo / Kanto ↔ Tokai / Kansai (Shinkansen) ─────
  'aichi:tokyo':         105,
  'aichi:kanagawa':       65,
  'aichi:kyoto':          35,
  'aichi:nara':           55,
  'aichi:osaka':          50,
  'aichi:shiga':          40,
  'kanagawa:kyoto':      120,
  'kanagawa:osaka':      135,
  'kyoto:tokyo':         140,
  'mie:nagoya':           45,
  'mie:osaka':            55,
  'nara:tokyo':          165,
  'osaka:tokyo':         155,
  'shiga:tokyo':         155,
  // ── Kansai local ─────────────────────────────────────
  'kyoto:nara':           45,
  'kyoto:osaka':          15,
  'nara:osaka':           40,
  'osaka:shiga':          40,
  // ── Kansai ↔ Chugoku ─────────────────────────────────
  'hiroshima:kyoto':     100,
  'hiroshima:osaka':      90,
  'hiroshima:okayama':    35,
  'okayama:kyoto':        60,
  'okayama:osaka':        50,
  // ── ↔ Kyushu (Shinkansen) ────────────────────────────
  'fukuoka:hiroshima':    60,
  'fukuoka:kagoshima':    40,
  'fukuoka:osaka':       155,
  'fukuoka:tokyo':       295,
  'kagoshima:osaka':     185,
  'kagoshima:tokyo':     330,
  // ── Tohoku Shinkansen ────────────────────────────────
  'akita:tokyo':         185,
  'aomori:tokyo':        195,
  'fukushima:tokyo':      90,
  'iwate:tokyo':         145,
  'miyagi:tokyo':        100,
  'yamagata:tokyo':      145,
  // ── Hokuriku Shinkansen ──────────────────────────────
  'ishikawa:tokyo':      155,
  'niigata:tokyo':       100,
  'toyama:tokyo':        130,
  // ── Hokkaido (flight, transfers included) ────────────
  'hokkaido:aomori':      80,
  'hokkaido:osaka':      150,
  'hokkaido:tokyo':      160,
  // ── Okinawa (flight, transfers included) ─────────────
  'okinawa:fukuoka':     120,
  'okinawa:hiroshima':   145,
  'okinawa:kagoshima':    90,
  'okinawa:nagasaki':    130,
  'okinawa:osaka':       150,
  'okinawa:tokyo':       210,
};

/* ─── Route-level travel time (pref→pref, minutes) ── */
function routeTravelMin(prefA, prefB) {
  if (!prefA || !prefB || prefA === prefB) return 0;
  const key = [prefA, prefB].sort().join(':');
  if (ROUTE_TABLE[key]) return ROUTE_TABLE[key];
  // Fallback: distance between prefecture centres
  const cA = PREF_CENTER[prefA], cB = PREF_CENTER[prefB];
  if (!cA || !cB) return 120;
  const dist = haversine(cA[0], cA[1], cB[0], cB[1]);
  if (dist <  30) return  40;
  if (dist <  80) return  70;
  if (dist < 150) return 110;
  if (dist < 300) return 160;
  if (dist < 500) return 210;
  return 270;
}

/* ─── Travel label ──────────────────────────── */
function travelLabel(a, b) {
  if (hasRealArea(a) && hasRealArea(b) && a.area === b.area && a._pref === b._pref)
    return '🚶 ~15 min walk';
  if (needsFlight(a, b)) {
    const from = PREF_LABEL[a._pref] || a._pref || '';
    const to   = PREF_LABEL[b._pref] || b._pref || '';
    return `✈️ Flight: ${from} → ${to} (~2.5h flight + airport transfers each side)`;
  }
  if (a._pref && a._pref === b._pref) {
    return `🚌 ~30 min (within ${PREF_LABEL[a._pref] || a._pref})`;
  }
  const dist = spotDist(a, b);
  const t = travelMin(a, b);
  if (dist < 0.8)  return `🚶 ~${t} min walk`;
  if (dist < 3)    return `🚇 ~${t} min (metro)`;
  if (dist < 8)    return `🚇 ~${t} min (train/metro)`;
  if (dist < 100)  return `🚄 ~${t} min (train)`;
  return `🚄 ~${t} min (Shinkansen)`;
}

/* ─── Itinerary generation ──────────────────── */
// Returns array of day-objects:
//   { type:'normal', spots:[...], travelNote:{from,to,flight,travelMin}|null, startOffset:N }
//   { type:'travel', from, to, flight, dist, travelMin }  — full-day travel only (flight / ≥360 min)
//
// Travel logic:
//   flight OR routeTravelMin ≥ FULL_DAY_TRAVEL_MIN → dedicated full travel day
//   otherwise → embed travel in the next sightseeing day (travelNote), reducing available hours
function generateItinerary(spots) {
  if (!spots.length) return [];

  // 1. Group spots by prefecture
  const prefMap = {};
  spots.forEach(s => {
    const p = s._pref || 'other';
    if (!prefMap[p]) prefMap[p] = [];
    prefMap[p].push(s);
  });

  // 2. Sort prefectures N→S by their average latitude
  const sortedPrefs = Object.keys(prefMap).sort((pa, pb) => {
    const avg = arr => arr.reduce((s, x) => s + spotLat(x), 0) / arr.length;
    return avg(prefMap[pb]) - avg(prefMap[pa]);
  });

  // 3. Build ordered spot list per pref, with travel markers between distant prefs
  const segments = [];
  let prevLastSpot = null;

  sortedPrefs.forEach(pref => {
    const areaMap = {};
    prefMap[pref].forEach(s => {
      const k = spotArea(s) || 'other';
      if (!areaMap[k]) areaMap[k] = [];
      areaMap[k].push(s);
    });
    const sortedAreas = Object.keys(areaMap).sort((a, b) =>
      spotLat(areaMap[b][0]) - spotLat(areaMap[a][0])
    );
    const ordered = [];
    sortedAreas.forEach(k => areaMap[k].forEach(s => ordered.push(s)));

    if (prevLastSpot && ordered.length) {
      const firstSpot = ordered[0];
      const flight    = needsFlight(prevLastSpot, firstSpot);
      const dist      = spotDist(prevLastSpot, firstSpot);
      if (flight || dist > 200) {
        segments.push({ type: 'travel',
          from: prevLastSpot._pref, to: pref, flight, dist });
      }
    }

    segments.push({ type: 'spots', pref, spots: ordered });
    if (ordered.length) prevLastSpot = ordered[ordered.length - 1];
  });

  // 4. Pack into day objects
  //    • Flights or journeys ≥ FULL_DAY_TRAVEL_MIN → dedicated travel day
  //    • Shorter Shinkansen/train journeys → embed as travelNote in sightseeing day
  const days     = [];
  let daySpots   = [];
  let dayMinUsed = 0;    // minutes consumed this day (travel + spots)
  let dayTravel  = null; // pending travel note for start of current day

  const flushDay = () => {
    if (daySpots.length > 0) {
      days.push({
        type:        'normal',
        spots:       [...daySpots],
        travelNote:  dayTravel,
        startOffset: dayTravel ? dayTravel.travelMin : 0,
      });
    }
    daySpots   = [];
    dayMinUsed = 0;
    dayTravel  = null;
  };

  segments.forEach(seg => {
    if (seg.type === 'travel') {
      const tMin = routeTravelMin(seg.from, seg.to);
      if (seg.flight || tMin >= FULL_DAY_TRAVEL_MIN) {
        // Long / flight journey → dedicated full travel day
        flushDay();
        days.push({ type: 'travel', from: seg.from, to: seg.to,
                    flight: seg.flight, dist: seg.dist, travelMin: tMin });
      } else {
        // Shinkansen / short journey → embed in next sightseeing day
        flushDay();
        dayTravel  = { from: seg.from, to: seg.to, flight: seg.flight, travelMin: tMin };
        dayMinUsed = tMin;   // travel already consumes this much of the day
      }
    } else {
      seg.spots.forEach(spot => {
        const intraTravel = daySpots.length
          ? travelMin(daySpots[daySpots.length - 1], spot) : 0;
        const needed = (spot.avg_duration_min || 60) + intraTravel;
        if (dayMinUsed + needed > MAX_DAY_MIN && daySpots.length > 0) flushDay();
        daySpots.push(spot);
        dayMinUsed += needed;
      });
    }
  });
  flushDay();
  return days;
}

/* ─── Render: spot card ─────────────────────── */
function renderCard(spot) {
  const inPlan = planCart.has(spot.id);
  const color  = CAT_COLOR[spot.cats?.[0]] || '#555';
  const icon   = CAT_ICON[spot.cats?.[0]]  || '📍';
  const feeChip = spot.entry_fee === 0
    ? `<span class="pb-info-chip free">🆓 Free entry</span>`
    : `<span class="pb-info-chip paid">💴 ${fmtYenNum(spot.entry_fee)}</span>`;
  const durChip  = `<span class="pb-info-chip">⏱ ~${fmtDur(spot.avg_duration_min || 60)}</span>`;
  const starsHtml = spot.rating
    ? `<span class="pb-stars">${renderStars(spot.rating)}</span>
       <span class="pb-rating-val">${spot.rating}</span>
       ${spot.review_count ? popBadge(spot.review_count) : ''}`
    : '';
  const reviewsLine = spot.review_count
    ? `<span style="font-size:.68rem;color:#aaa;">${fmtReviews(spot.review_count)}</span>` : '';

  return `
<div class="pb-spot-card ${inPlan ? 'in-plan' : ''}" data-id="${spot.id}">
  ${spot.img
    ? `<img class="pb-card-img" src="${spot.img}" alt="${spot.name}" loading="lazy"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
       <div class="pb-card-img-ph" style="display:none">${icon}</div>`
    : `<div class="pb-card-img-ph">${icon}</div>`
  }
  <div class="pb-card-body">
    <div class="pb-card-meta">
      <span class="pb-cat-badge" style="background:${color}">${spot.cats?.[0] || 'spot'}</span>
      <span class="pb-card-location">📍 ${spot.location}</span>
    </div>
    <h3 class="pb-card-name">${spot.name}</h3>
    <div class="pb-stars-row">${starsHtml}${reviewsLine}</div>
    <div class="pb-card-info">${feeChip}${durChip}</div>
    <p class="pb-card-desc">${spot.desc || ''}</p>
    <button class="pb-add-btn ${inPlan ? 'remove' : 'add'}" onclick="togglePlan('${spot.id}')">
      ${inPlan ? '✓ Remove from Plan' : '＋ Add to Plan'}
    </button>
  </div>
</div>`;
}

/* ─── Render: cart items ────────────────────── */
function renderCart() {
  const badge  = document.getElementById('pb-cart-badge');
  const items  = document.getElementById('pb-cart-items');
  const totals = document.getElementById('pb-cart-totals');
  const genBtn = document.getElementById('pb-generate-btn');
  const count  = planCart.size;

  badge.textContent = count + (count === 1 ? ' spot' : ' spots');
  genBtn.disabled   = count === 0;

  if (count === 0) {
    items.innerHTML = `<p class="pb-cart-empty">
      <span class="pb-empty-icon">🗺️</span>
      Add spots from the search results to start building your itinerary.
    </p>`;
    totals.innerHTML = '';
    return;
  }

  const spotArr = [...planCart.values()];
  let totalFee  = 0;
  let totalMin  = 0;

  items.innerHTML = spotArr.map(s => {
    totalFee += (s.entry_fee || 0);
    totalMin += (s.avg_duration_min || 60);
    return `<div class="pb-cart-item">
      ${s.img
        ? `<img class="pb-cart-item-thumb" src="${s.img}" alt="${s.name}" loading="lazy"
               onerror="this.src=''">`
        : `<div class="pb-cart-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:#eef0f6;">${CAT_ICON[s.cats?.[0]]||'📍'}</div>`
      }
      <div class="pb-cart-item-info">
        <div class="pb-cart-item-name">${s.name}</div>
        <div class="pb-cart-item-sub">${fmtYen(s.entry_fee)} · ~${fmtDur(s.avg_duration_min || 60)}</div>
      </div>
      <button class="pb-cart-item-remove" onclick="togglePlan('${s.id}')" title="Remove">✕</button>
    </div>`;
  }).join('');

  // Estimate days & flights
  const days       = generateItinerary(spotArr);
  const visitDays  = days.filter(d => d.type === 'normal').length;
  const flightSegs = days.filter(d => d.type === 'travel' && d.flight).length;
  const hotelNights = Math.max(0, days.length - 1);
  const hotelEst    = hotelNights * 10000;
  const flightEst   = flightSegs * 20000;
  const totalEst    = totalFee + hotelEst + flightEst;

  const dayLine = flightSegs > 0
    ? `${visitDays} sightseeing + ${flightSegs} ✈️ day${flightSegs>1?'s':''}`
    : `${visitDays} day${visitDays!==1?'s':''}`;
  const costLine = totalEst > 0
    ? `from ¥${totalEst.toLocaleString()} est.`
    : 'Entry fees free';

  totals.innerHTML = `
    <div>Entry Fees: <strong>${totalFee > 0 ? '¥'+totalFee.toLocaleString() : 'Free'}</strong></div>
    ${hotelNights > 0 ? `<div>Hotels (budget ~¥10k/night × ${hotelNights}): <strong>¥${hotelEst.toLocaleString()}</strong></div>` : ''}
    ${flightSegs > 0  ? `<div>Flights × ${flightSegs} (budget est.): <strong>from ¥${flightEst.toLocaleString()}</strong></div>` : ''}
    <div>Activity Time: <strong>~${fmtDur(totalMin)}</strong></div>
    <div>Estimated Days: <strong>${dayLine}</strong></div>`;
}

/* ─── Toggle plan cart ──────────────────────── */
window.togglePlan = function(id) {
  const spot = allSpots.find(s => s.id === id);
  if (!spot) return;
  if (planCart.has(id)) {
    planCart.delete(id);
  } else {
    planCart.set(id, spot);
  }
  saveCart();
  // Sync floating badge (prefecture pages)
  syncFloatingBadge();
  if (typeof window.updateNavPlanBadge === 'function') window.updateNavPlanBadge();
  // Re-render card
  const card = document.querySelector(`.pb-spot-card[data-id="${id}"]`);
  if (card) card.outerHTML = renderCard(spot);
  renderCart();
};

/* ─── Sync floating plan button (uses global in baseof.html) ─ */
function syncFloatingBadge() {
  if (typeof window.syncPlanFloat === 'function') window.syncPlanFloat();
}

/* ─── Simple keyword search (no external library) ── */
function simpleSearch(q, spots) {
  if (!q.trim()) return spots;
  const terms = q.toLowerCase().trim().split(/\s+/);
  // Score: name/tag matches rank higher
  return spots
    .map(s => {
      const nameField  = (s.name     || '').toLowerCase();
      const tagField   = (s.tags     || []).join(' ').toLowerCase();
      const areaField  = (s.area     || '').toLowerCase();
      const locField   = (s.location || '').toLowerCase();
      const descField  = (s.desc     || '').toLowerCase();
      const catField   = (s.cats     || []).join(' ').toLowerCase();
      const haystack   = [nameField, tagField, areaField, locField, catField, descField].join(' ');
      const matchAll   = terms.every(t => haystack.includes(t));
      if (!matchAll) return null;
      // Higher score = more relevant
      const score = terms.reduce((acc, t) => {
        return acc
          + (nameField.includes(t)  ? 8 : 0)
          + (tagField.includes(t)   ? 4 : 0)
          + (areaField.includes(t)  ? 3 : 0)
          + (catField.includes(t)   ? 3 : 0)
          + (locField.includes(t)   ? 2 : 0)
          + (descField.includes(t)  ? 1 : 0);
      }, 0);
      return { spot: s, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map(r => r.spot);
}

/* ─── Prefecture label map ──────────────────── */
const PREF_LABEL = {
  hokkaido:'Hokkaido', iwate:'Iwate', miyagi:'Miyagi', akita:'Akita',
  yamagata:'Yamagata', fukushima:'Fukushima', tokyo:'Tokyo',
  kanagawa:'Kanagawa', chiba:'Chiba', saitama:'Saitama',
  ibaraki:'Ibaraki', tochigi:'Tochigi', gunma:'Gunma',
  niigata:'Niigata', toyama:'Toyama', ishikawa:'Ishikawa (Kanazawa)',
  nagano:'Nagano', yamanashi:'Yamanashi', shizuoka:'Shizuoka',
  aichi:'Aichi (Nagoya)', gifu:'Gifu', shiga:'Shiga',
  kyoto:'Kyoto', osaka:'Osaka', nara:'Nara', mie:'Mie',
  okayama:'Okayama', tokushima:'Tokushima', kagawa:'Kagawa',
  ehime:'Ehime', kochi:'Kochi', kagoshima:'Kagoshima', okinawa:'Okinawa',
};

const DISPLAY_MAX = 50; // max cards when no search query entered

/* ─── Search & filter ───────────────────────── */
function doSearch() {
  const q    = (document.getElementById('pb-search')?.value || '').trim();
  const cat  = document.getElementById('pb-cat-filter')?.value || '';
  const pref = document.getElementById('pb-pref-filter')?.value || '';
  let results = simpleSearch(q, allSpots);
  if (pref) results = results.filter(s => s._pref === pref);
  if (cat)  results = results.filter(s => s.cats?.includes(cat));

  const grid  = document.getElementById('pb-results-grid');
  const cntEl = document.getElementById('pb-result-count');
  const total = results.length;

  // Cap display when browsing without a query (too many cards)
  const showAll  = q.length > 0;
  const display  = (!showAll && total > DISPLAY_MAX) ? results.slice(0, DISPLAY_MAX) : results;
  const truncated = total - display.length;

  cntEl.textContent = total + ' spot' + (total !== 1 ? 's' : '');

  if (total === 0) {
    grid.innerHTML = `<div class="pb-no-results">
      <span class="pb-no-icon">🔍</span>
      <p>No spots found. Try a different search term or prefecture.</p>
    </div>`;
    return;
  }

  let html = display.map(renderCard).join('');
  if (truncated > 0) {
    html += `<div class="pb-show-more" style="grid-column:1/-1;text-align:center;padding:1.2rem 0;">
      <p style="color:#888;font-size:.85rem;margin-bottom:.6rem;">
        Showing ${display.length} of ${total} spots — search to narrow results
      </p>
    </div>`;
  }
  grid.innerHTML = html;
}

/* ─── Generate & render itinerary ──────────── */
document.getElementById('pb-generate-btn').addEventListener('click', function() {
  const spotArr  = [...planCart.values()];
  const days     = generateItinerary(spotArr);

  // Classify day types
  const visitDays  = days.filter(d => d.type === 'normal');
  const travelDays = days.filter(d => d.type === 'travel');
  const flightDays = travelDays.filter(d => d.flight);

  // Cost estimates
  const entryFees   = spotArr.reduce((s, x) => s + (x.entry_fee || 0), 0);
  const flightEst   = flightDays.length * 20000;  // ~¥20,000 per segment (budget avg)
  const hotelNights = Math.max(0, days.length - 1);
  const hotelEst    = hotelNights * 10000;         // ~¥10,000/night budget hotel
  const totalDur    = spotArr.reduce((s, x) => s + (x.avg_duration_min || 60), 0);

  // Dynamic title
  const prefs = [...new Set(spotArr.map(s => s._pref).filter(Boolean))];
  const titlePref = prefs.length === 1 ? (PREF_LABEL[prefs[0]] || prefs[0]) : 'Japan';
  const titleEl = document.getElementById('pb-itin-title');
  if (titleEl) titleEl.textContent = `📅 Your ${titlePref} Itinerary`;

  // ── Summary cards ──
  const hotelCard = hotelNights > 0
    ? `<div class="pb-itin-summary-card">
         <span class="s-icon">🏨</span>
         <span class="s-val">~¥${hotelEst.toLocaleString()}</span>
         <span class="s-label">Hotels est. (${hotelNights} night${hotelNights>1?'s':''})</span>
       </div>` : '';
  const flightCard = flightDays.length > 0
    ? `<div class="pb-itin-summary-card" style="border-color:#f0b429">
         <span class="s-icon">✈️</span>
         <span class="s-val">from ¥${flightEst.toLocaleString()}</span>
         <span class="s-label">Flights est. (${flightDays.length} segment${flightDays.length>1?'s':''})</span>
       </div>` : '';

  document.getElementById('pb-itin-summary').innerHTML = `
    <div class="pb-itin-summary-card">
      <span class="s-icon">📅</span>
      <span class="s-val">${days.length}</span>
      <span class="s-label">Total Day${days.length>1?'s':''}</span>
    </div>
    <div class="pb-itin-summary-card">
      <span class="s-icon">📍</span>
      <span class="s-val">${spotArr.length}</span>
      <span class="s-label">Spot${spotArr.length>1?'s':''}</span>
    </div>
    <div class="pb-itin-summary-card">
      <span class="s-icon">🎟</span>
      <span class="s-val">${entryFees > 0 ? '¥'+entryFees.toLocaleString() : 'Free'}</span>
      <span class="s-label">Entry Fees</span>
    </div>
    <div class="pb-itin-summary-card">
      <span class="s-icon">⏱</span>
      <span class="s-val">~${fmtDur(totalDur)}</span>
      <span class="s-label">Activity Time</span>
    </div>
    ${hotelCard}
    ${flightCard}`;

  // ── Day cards ──
  let daysHtml = '';
  let dayNum = 0; // visible day counter (includes travel days)

  days.forEach(day => {
    dayNum++;

    if (day.type === 'travel') {
      // ── Full travel day card (flight or very long journey) ──
      const fromLabel = PREF_LABEL[day.from] || day.from || '';
      const toLabel   = PREF_LABEL[day.to]   || day.to   || '';
      const icon      = day.flight ? '✈️' : '🚄';
      const mode      = day.flight ? 'Flight' : 'Shinkansen';
      const tMin      = day.travelMin || Math.round(day.dist / 2);
      const timeNote  = day.flight
        ? `Allow a full day (~${tMin} min total): depart morning, airport check-in (90 min before), ~${Math.max(60, tMin - 120)} min flight, arrival transfers. Book early for best fares.`
        : `~${tMin} min by Shinkansen. Depart morning and arrive in time for a relaxed evening. Check JR Pass coverage for this route.`;
      const warning   = day.flight
        ? `⚠️ Book domestic flights in advance. Budget airlines (Peach, Jetstar) from ~¥8,000; average ~¥20,000–35,000/person.`
        : `💡 JR Pass holders ride Shinkansen free on most routes.`;
      const searchQ   = day.flight
        ? encodeURIComponent(fromLabel + ' to ' + toLabel + ' flight')
        : encodeURIComponent(fromLabel + ' ' + toLabel + ' shinkansen');

      daysHtml += `
        <div class="pb-day-card pb-day-travel">
          <div class="pb-day-hd">
            <h3>${icon} Day ${dayNum} — Travel: ${fromLabel} → ${toLabel}</h3>
            <div class="pb-day-chips">
              <span class="pb-day-chip">${mode}</span>
              <span class="pb-day-chip">🌙 Hotel night before</span>
            </div>
          </div>
          <div class="pb-travel-day-body">
            <div class="pb-travel-day-icon">${icon}</div>
            <div class="pb-travel-day-info">
              <p class="pb-travel-day-route">${fromLabel} → ${toLabel}</p>
              <p class="pb-travel-day-note">${timeNote}</p>
              <span class="pb-travel-day-warning">${warning}</span>
              <div class="pb-travel-day-links">
                ${day.flight
                  ? `<a class="pb-travel-day-link" href="https://www.google.com/search?q=${searchQ}" target="_blank" rel="noopener">Search Flights →</a>
                     <a class="pb-travel-day-link" href="https://www.booking.com/index.html?aid=1234" target="_blank" rel="noopener">Find Hotels →</a>`
                  : `<a class="pb-travel-day-link" href="https://www.jrpass.com/?a=jrpass" target="_blank" rel="noopener">JR Pass Info →</a>
                     <a class="pb-travel-day-link" href="https://www.booking.com/index.html?aid=1234" target="_blank" rel="noopener">Find Hotels →</a>`
                }
              </div>
            </div>
          </div>
        </div>`;

    } else {
      // ── Normal sightseeing day card (may include a Shinkansen arrival note) ──
      const daySpots  = day.spots;
      const offset    = day.startOffset || 0;
      const areas     = [...new Set(daySpots.map(s => spotArea(s) || ''))].filter(Boolean);
      const areaLabel = areas.slice(0, 3).map(a => a.charAt(0).toUpperCase()+a.slice(1)).join(' / ');
      const dayCost   = daySpots.reduce((s, x) => s + (x.entry_fee || 0), 0);

      // ── Travel arrival banner (for same-day Shinkansen travel) ──
      let arrivalHtml = '';
      if (day.travelNote) {
        const tn        = day.travelNote;
        const tnFrom    = PREF_LABEL[tn.from] || tn.from || '';
        const tnTo      = PREF_LABEL[tn.to]   || tn.to   || '';
        const tnIcon    = tn.flight ? '✈️' : '🚄';
        const arrTime   = fmtTime(tn.travelMin);
        const tnNote    = tn.flight
          ? `~${tn.travelMin} min total · Depart 09:00 · Arrive ~${arrTime} (incl. airport transfers). Book flights in advance.`
          : `~${tn.travelMin} min Shinkansen · Depart 09:00 · Arrive ~${arrTime} · Sightseeing starts after arrival.`;
        const tnWarn    = tn.flight
          ? `⚠️ Budget airlines (Peach, Jetstar) from ~¥8,000.`
          : `💡 JR Pass holders ride Shinkansen free on most routes.`;
        const tnSearch  = tn.flight
          ? encodeURIComponent(tnFrom + ' to ' + tnTo + ' flight')
          : encodeURIComponent(tnFrom + ' ' + tnTo + ' shinkansen');
        const tnLink    = tn.flight
          ? `<a class="pb-travel-day-link" href="https://www.google.com/search?q=${tnSearch}" target="_blank" rel="noopener">Search Flights →</a>`
          : `<a class="pb-travel-day-link" href="https://www.jrpass.com/?a=jrpass" target="_blank" rel="noopener">JR Pass Info →</a>`;
        arrivalHtml = `
          <div style="background:linear-gradient(135deg,#e8f0ff,#d0e4ff);border-radius:10px;padding:.75rem 1rem;margin-bottom:1rem;display:flex;align-items:flex-start;gap:.8rem;">
            <div style="font-size:1.4rem;flex-shrink:0">${tnIcon}</div>
            <div>
              <div style="font-size:.95rem;font-weight:800;color:#0a3a7a;">${tnFrom} → ${tnTo}</div>
              <div style="font-size:.82rem;color:#555;margin:.25rem 0;">${tnNote}</div>
              <span class="pb-travel-day-warning">${tnWarn}</span>
              <div style="margin-top:.4rem;">${tnLink}</div>
            </div>
          </div>`;
      }

      let tlHtml = '';
      daySpots.forEach((spot, i) => {
        // Start time = travel offset + accumulated spot durations + intra-spot travel
        const startMinOfDay = offset
          + daySpots.slice(0, i).reduce((acc, s, si) => {
              return acc + (s.avg_duration_min || 60) + (si === 0 ? 0 : travelMin(daySpots[si-1], s));
            }, 0)
          + (i === 0 ? 0 : travelMin(daySpots[i-1], spot));

        const timeDisplay = fmtTime(startMinOfDay);
        const isLast = i === daySpots.length - 1;
        const travelNote = i > 0
          ? `<div class="pb-tl-travel">${travelLabel(daySpots[i-1], spot)}</div>` : '';

        tlHtml += `
          ${travelNote}
          <div class="pb-timeline-item">
            <div class="pb-tl-left">
              <div class="pb-tl-time">${timeDisplay}</div>
              <div class="pb-tl-dot"></div>
              ${!isLast ? '<div class="pb-tl-line"></div>' : ''}
            </div>
            <div class="pb-tl-content">
              <div class="pb-tl-spot">
                ${spot.img
                  ? `<img class="pb-tl-spot-img" src="${spot.img}" alt="${spot.name}" loading="lazy" onerror="this.src=''">`
                  : `<div class="pb-tl-spot-img" style="display:flex;align-items:center;justify-content:center;font-size:1.4rem;background:#eef0f6;">${CAT_ICON[spot.cats?.[0]]||'📍'}</div>`
                }
                <div>
                  <div class="pb-tl-spot-name">${spot.name}</div>
                  <div class="pb-tl-spot-meta">
                    <span>📍 ${spotLocation(spot)}</span>
                    <span>⏱ ~${fmtDur(spot.avg_duration_min || 60)}</span>
                    <span>💴 ${fmtYen(spot.entry_fee)}</span>
                    ${spot.rating ? `<span><span class="pb-tl-stars">${renderStars(spot.rating)}</span> ${spot.rating}</span>` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>`;
      });

      daysHtml += `
        <div class="pb-day-card">
          <div class="pb-day-hd">
            <h3>📅 Day ${dayNum}${day.travelNote
              ? ` — ${PREF_LABEL[day.travelNote.from]||day.travelNote.from} → ${PREF_LABEL[day.travelNote.to]||day.travelNote.to}${areaLabel ? ' · ' + areaLabel : ''}`
              : (areaLabel ? ' — ' + areaLabel : '')}</h3>
            <div class="pb-day-chips">
              ${day.travelNote ? `<span class="pb-day-chip">${day.travelNote.flight?'✈️':'🚄'} ${PREF_LABEL[day.travelNote.from]||day.travelNote.from} → ${PREF_LABEL[day.travelNote.to]||day.travelNote.to}</span>` : ''}
              <span class="pb-day-chip">${daySpots.length} spot${daySpots.length>1?'s':''}</span>
              <span class="pb-day-chip">💴 ${dayCost > 0 ? '¥'+dayCost.toLocaleString() : 'Free day'}</span>
            </div>
          </div>
          <div class="pb-timeline">${arrivalHtml}${tlHtml}</div>
        </div>`;
    }
  });

  document.getElementById('pb-itin-days').innerHTML = daysHtml;

  // Subtitle
  const totalEst = entryFees + flightEst + hotelEst;
  const subtitleParts = [
    `${spotArr.length} spot${spotArr.length>1?'s':''}`,
    `${visitDays.length} sightseeing day${visitDays.length>1?'s':''}`,
    flightDays.length > 0 ? `${flightDays.length} flight${flightDays.length>1?'s':''}` : null,
    totalEst > 0 ? `est. from ¥${totalEst.toLocaleString()}` : 'entry fees free',
  ].filter(Boolean);
  document.getElementById('pb-itin-subtitle').textContent = subtitleParts.join(' · ');

  const sec = document.getElementById('pb-itinerary-section');
  sec.style.display = 'block';
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ─── Clear cart ────────────────────────────── */
document.getElementById('pb-clear-btn').addEventListener('click', function() {
  if (!planCart.size) return;
  if (confirm('Clear all spots from your plan?')) {
    planCart.clear();
    saveCart();
    syncFloatingBadge();
    document.getElementById('pb-itinerary-section').style.display = 'none';
    doSearch();
    renderCart();
  }
});

/* ─── Init ──────────────────────────────────── */
(function init() {
  // Flatten all spots from all prefectures in DB (loaded from /js/spots-db.js)
  var db = (typeof SPOTS_DB !== 'undefined' ? SPOTS_DB : window.SPOTS_DB) || {};
  Object.entries(db).forEach(function(entry) {
    var pref  = entry[0];
    var spots = entry[1] || [];
    if (!Array.isArray(spots)) return;
    spots.forEach(function(s) {
      allSpots.push(Object.assign({}, s, { _pref: pref }));
    });
  });

  // Render initial state (synchronous — no external deps)
  doSearch();
  renderCart();
  syncFloatingBadge();
  if (typeof window.updateNavPlanBadge === 'function') window.updateNavPlanBadge();

  // Event listeners
  var searchTimer;
  document.getElementById('pb-search').addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 150);
  });
  document.getElementById('pb-cat-filter').addEventListener('change', doSearch);
  document.getElementById('pb-pref-filter').addEventListener('change', doSearch);
})();

})();