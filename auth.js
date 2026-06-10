// ╔══════════════════════════════════════════════════════════════╗
// ║              VESFLY TV — AUTH CONFIGURATION                  ║
// ║  Add / remove users below. No signup page needed.           ║
// ║  Format:  "username": "password"                            ║
// ╚══════════════════════════════════════════════════════════════╝

const VESFLY_USERS = {
  "glass":    "glass",
  "fahim":    "terenaam",
  "sadi":     "dilsepassword",
  "pranto":   "burger",
  "hakim":    "engineer",
  "ne":       "dekh",
  "oilo":     "kichu-koitam-na",
  "nee":      "khaaaa",
};

// Session key
const SESSION_KEY = 'vesfly_session';

const Auth = {
  login(username, password) {
    const users = VESFLY_USERS;
    if (users[username] && users[username] === password) {
      const session = {
        username,
        loginTime: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return true;
    }
    return false;
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
  },

  isLoggedIn() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    try {
      const session = JSON.parse(raw);
      if (Date.now() > session.expires) {
        sessionStorage.removeItem(SESSION_KEY);
        return false;
      }
      return true;
    } catch { return false; }
  },

  getUser() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  // Call on protected pages — redirects to login if not authenticated
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
};
