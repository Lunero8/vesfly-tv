// ═══════════════════════════════════════════════════════
//  VESFLY TV — Core App Logic
//  Channel loading, filtering, rendering, player
// ═══════════════════════════════════════════════════════

// Target countries for football coverage
const TARGET_COUNTRIES = ['bd','in','pk','gb','qa','sa','ae','kw','tr','fr','de','es','it','us','br','nl','pt','ar','mx','ru','jo','eg'];

// Football-relevant keywords for channel filtering
const SPORTS_KEYWORDS = ['sport','sports','football','soccer','futbol','bein','star sport','sony sport','sky sport','eurosport','espn','fox sport','laliga','bundesliga','premier','serie a','ligue','supersport','arena sport','ss sport','pptv','ssc'];

function isSportsChannel(ch) {
  const name = (ch.name || '').toLowerCase();
  const cats = (ch.categories || []).map(c => c.toLowerCase());
  return SPORTS_KEYWORDS.some(k => name.includes(k)) ||
         cats.some(c => c.includes('sport') || c.includes('football') || c.includes('soccer'));
}

// ── Fetch channels from iptv-org API ──
let _cachedChannels = null;
let _cachedStreams   = null;

async function loadChannels() {
  if (_cachedChannels) return _cachedChannels;
  try {
    // Fetch channel metadata
    const [chRes, stRes] = await Promise.all([
      fetch('https://iptv-org.github.io/api/channels.json'),
      fetch('https://iptv-org.github.io/api/streams.json')
    ]);
    const allChannels = await chRes.json();
    const allStreams   = await stRes.json();
    _cachedStreams = allStreams;

    // Filter by target countries
    const filtered = allChannels.filter(ch =>
      TARGET_COUNTRIES.includes((ch.country || '').toLowerCase())
    );

    // Attach stream URLs
    const streamMap = {};
    allStreams.forEach(s => {
      if (!streamMap[s.channel]) streamMap[s.channel] = s.url;
    });
    filtered.forEach(ch => { ch.streamUrl = streamMap[ch.id] || null; });

    // Sort: sports first, then by name
    filtered.sort((a, b) => {
      const aS = isSportsChannel(a) ? 0 : 1;
      const bS = isSportsChannel(b) ? 0 : 1;
      if (aS !== bS) return aS - bS;
      return (a.name || '').localeCompare(b.name || '');
    });

    _cachedChannels = filtered;
    return filtered;
  } catch (e) {
    console.error('Failed to load channels:', e);
    return [];
  }
}

// ── Country name map ──
const COUNTRY_NAMES = {
  bd:'Bangladesh', in:'India', pk:'Pakistan', gb:'United Kingdom', qa:'Qatar',
  sa:'Saudi Arabia', ae:'UAE', kw:'Kuwait', tr:'Turkey', fr:'France', de:'Germany',
  es:'Spain', it:'Italy', us:'USA', br:'Brazil', nl:'Netherlands', pt:'Portugal',
  ar:'Argentina', mx:'Mexico', ru:'Russia', jo:'Jordan', eg:'Egypt'
};
const COUNTRY_FLAGS = {
  bd:'🇧🇩', in:'🇮🇳', pk:'🇵🇰', gb:'🇬🇧', qa:'🇶🇦', sa:'🇸🇦', ae:'🇦🇪', kw:'🇰🇼',
  tr:'🇹🇷', fr:'🇫🇷', de:'🇩🇪', es:'🇪🇸', it:'🇮🇹', us:'🇺🇸', br:'🇧🇷',
  nl:'🇳🇱', pt:'🇵🇹', ar:'🇦🇷', mx:'🇲🇽', ru:'🇷🇺', jo:'🇯🇴', eg:'🇪🇬'
};

function getFlag(code) { return COUNTRY_FLAGS[(code||'').toLowerCase()] || '🌐'; }
function getCountryName(code) { return COUNTRY_NAMES[(code||'').toLowerCase()] || code || 'International'; }

// ── Render channel card ──
function createChannelCard(ch, delay = 0) {
  const card = document.createElement('div');
  card.className = 'channel-card';
  card.style.animationDelay = delay + 'ms';

  const flag = getFlag(ch.country);
  const country = getCountryName(ch.country);
  const cat = (ch.categories && ch.categories[0]) ? ch.categories[0] : 'General';
  const hasStream = !!ch.streamUrl;

  card.innerHTML = `
    <div class="channel-thumb">
      ${ch.logo
        ? `<img src="${ch.logo}" alt="${ch.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="no-logo" style="display:none">📺</div>`
        : `<div class="no-logo">📺</div>`
      }
      ${hasStream ? `<div class="live-pill"><div class="dot"></div>LIVE</div>` : ''}
      ${!hasStream ? `<div style="position:absolute;bottom:8px;right:8px;font-family:'Space Mono',monospace;font-size:8px;color:#3d5166;background:rgba(0,0,0,0.6);padding:2px 6px;border-radius:4px;">OFFLINE</div>` : ''}
    </div>
    <div class="channel-info">
      <div class="channel-name" title="${ch.name}">${ch.name}</div>
      <div class="channel-meta">
        <div class="channel-country">${flag} ${country}</div>
        <div class="channel-cat">${cat}</div>
      </div>
    </div>
  `;

  card.addEventListener('click', () => playChannel(ch));
  return card;
}

function renderGrid(gridId, channels) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';

  if (!channels || channels.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">📡</div><p>No channels found</p></div>';
    return;
  }

  channels.forEach((ch, i) => {
    grid.appendChild(createChannelCard(ch, i * 50));
  });
}

// ── HLS Player ──
let currentHls = null;

function playChannel(ch) {
  const modal    = document.getElementById('playerModal');
  const loading  = document.getElementById('playerLoading');
  const errBox   = document.getElementById('streamError');
  const video    = document.getElementById('videoPlayer');
  const nameEl   = document.getElementById('modalChannelName');
  const countryEl= document.getElementById('modalCountry');
  const catEl    = document.getElementById('modalCat');
  const iconEl   = document.getElementById('modalIcon');

  if (!ch.streamUrl) {
    alert('This channel has no stream available at the moment.');
    return;
  }

  // Reset state
  if (currentHls) { currentHls.destroy(); currentHls = null; }
  video.style.display = 'none';
  video.src = '';
  loading.style.display = 'flex';
  errBox.classList.remove('show');
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Fill info
  nameEl.textContent  = ch.name;
  countryEl.textContent = getFlag(ch.country) + ' ' + getCountryName(ch.country);
  catEl.textContent    = (ch.categories && ch.categories[0]) || 'General';
  iconEl.textContent   = '📺';

  const url = ch.streamUrl;

  // Try HLS.js first (for m3u8 streams)
  if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      xhrSetup: (xhr) => { xhr.timeout = 10000; }
    });
    currentHls = hls;
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      loading.style.display = 'none';
      video.style.display = 'block';
      video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        loading.style.display = 'none';
        errBox.classList.add('show');
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Native HLS (Safari)
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      loading.style.display = 'none';
      video.style.display = 'block';
      video.play().catch(() => {});
    }, { once: true });
    video.addEventListener('error', () => {
      loading.style.display = 'none';
      errBox.classList.add('show');
    }, { once: true });
  } else {
    // Fallback direct
    video.src = url;
    loading.style.display = 'none';
    video.style.display = 'block';
  }

  // Timeout fallback
  setTimeout(() => {
    if (loading.style.display !== 'none') {
      loading.style.display = 'none';
      errBox.classList.add('show');
    }
  }, 15000);
}

function closePlayer() {
  const modal = document.getElementById('playerModal');
  const video = document.getElementById('videoPlayer');
  if (currentHls) { currentHls.destroy(); currentHls = null; }
  video.pause();
  video.src = '';
  modal.classList.remove('show');
  document.body.style.overflow = '';
}

// Close modal on overlay click
document.addEventListener('click', e => {
  const overlay = document.getElementById('playerModal');
  if (e.target === overlay) closePlayer();
});

// ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePlayer();
});

// ── Favorites (localStorage) ──
const FAV_KEY = 'vesfly_favorites';

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function toggleFavorite(channelId) {
  let favs = getFavorites();
  if (favs.includes(channelId)) {
    favs = favs.filter(id => id !== channelId);
  } else {
    favs.push(channelId);
  }
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  return favs.includes(channelId);
}
function isFavorite(channelId) {
  return getFavorites().includes(channelId);
}
