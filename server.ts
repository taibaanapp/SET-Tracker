import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';
import Database from 'better-sqlite3';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import cookieSession from 'cookie-session';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const yf = new (YahooFinance as any)();

// --- Database Setup ---
const isProduction = process.env.NODE_ENV === 'production';
const dbDir = isProduction ? '/data' : process.cwd();
let dbFile = path.join(dbDir, 'data.db');

// Safety check for production directory
if (isProduction && !fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    console.error('Warning: Could not create /data directory, falling back to local storage.');
    dbFile = path.join(process.cwd(), 'data.db');
  }
}

let db: any;
try {
  db = new Database(dbFile);
  console.log('Database connected at:', dbFile);
} catch (e) {
  console.error('Database connection failed, using fallback:', e);
  db = new Database('fallback.db');
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    googleId TEXT UNIQUE,
    displayName TEXT,
    email TEXT,
    photoUrl TEXT
  );

  CREATE TABLE IF NOT EXISTS stocks (
    id TEXT PRIMARY KEY,
    symbol TEXT,
    name TEXT,
    avgCost REAL,
    totalShares REAL,
    currentPrice REAL,
    lastUpdated TEXT,
    userId TEXT,
    website TEXT,
    domain TEXT,
    industry TEXT,
    pe REAL,
    pbv REAL,
    marketCap REAL,
    freeFloat REAL,
    dividendYield REAL,
    history2Y TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    stockId TEXT,
    type TEXT,
    shares REAL,
    price REAL,
    date TEXT,
    notes TEXT,
    userId TEXT,
    FOREIGN KEY(stockId) REFERENCES stocks(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`);

// --- Passport Setup ---
const rawAppUrl = process.env.APP_URL || 'http://localhost:3000';
const appUrl = rawAppUrl.endsWith('/') ? rawAppUrl.slice(0, -1) : rawAppUrl;

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
    callbackURL: `${appUrl}/api/auth/google/callback`,
    scope: ['profile', 'email'],
    proxy: true // Required for Railway/Proxies
  },
  (accessToken, refreshToken, profile, done) => {
    try {
      const user = {
        id: profile.id,
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails?.[0]?.value || '',
        photoUrl: profile.photos?.[0]?.value || ''
      };

      console.log('Login attempt for:', user.email);

      const upsertUser = db.prepare(`
        INSERT INTO users (id, googleId, displayName, email, photoUrl)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          displayName = excluded.displayName,
          email = excluded.email,
          photoUrl = excluded.photoUrl
        RETURNING *
      `);
      
      const result = upsertUser.get(user.id, user.googleId, user.displayName, user.email, user.photoUrl);
      console.log('Login successful for:', user.email);
      return done(null, result);
    } catch (err) {
      console.error('PASSPORT STRATEGY ERROR:', err);
      return done(err);
    }
  }
));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser((id: string, done) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  done(null, user);
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Railway runs behind a proxy
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'keyboard cat'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }));

  // Fix for Passport 0.6+ and cookie-session (regenerate/save missing)
  app.use((req: any, res: any, next: any) => {
    if (req.session && !req.session.regenerate) {
      req.session.regenerate = (cb: any) => {
        cb();
      };
    }
    if (req.session && !req.session.save) {
      req.session.save = (cb: any) => {
        cb();
      };
    }
    next();
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // --- Auth Routes ---
  app.get('/api/auth/google', passport.authenticate('google', { 
    prompt: 'select_account' 
  }));

  app.get('/api/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      res.redirect('/');
    }
  );

  app.get('/api/auth/user', (req, res) => {
    res.json(req.user || null);
  });

  app.get('/api/users/count', (req, res) => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      res.json({ count: row.count });
    } catch (err) {
      res.status(500).json({ error: 'Failed to count users' });
    }
  });

  app.get('/api/auth/logout', (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session = null; // Clear session cookie
      res.redirect('/');
    });
  });

  // Middleware to check auth
  const ensureAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized' });
  };

  // --- Stock API ---
  app.get('/api/stocks', ensureAuthenticated, (req: any, res) => {
    const stocks = db.prepare('SELECT * FROM stocks WHERE userId = ?').all(req.user.id);
    res.json(stocks.map((s: any) => ({
      ...s,
      history2Y: s.history2Y ? JSON.parse(s.history2Y) : []
    })));
  });

  app.post('/api/stocks', ensureAuthenticated, (req: any, res) => {
    const stock = { ...req.body, id: crypto.randomUUID(), userId: req.user.id };
    const insert = db.prepare(`
      INSERT INTO stocks (id, symbol, name, avgCost, totalShares, currentPrice, lastUpdated, userId, website, domain, industry, pe, pbv, marketCap, freeFloat, dividendYield, history2Y)
      VALUES (@id, @symbol, @name, @avgCost, @totalShares, @currentPrice, @lastUpdated, @userId, @website, @domain, @industry, @pe, @pbv, @marketCap, @freeFloat, @dividendYield, @history2Y)
    `);
    insert.run({ ...stock, history2Y: JSON.stringify(stock.history2Y || []) });
    res.json(stock);
  });

  app.patch('/api/stocks/:id', ensureAuthenticated, (req: any, res) => {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    const update = db.prepare(`UPDATE stocks SET ${fields} WHERE id = @id AND userId = @userId`);
    update.run({ ...updates, id, userId: req.user.id });
    res.json({ success: true });
  });

  app.delete('/api/stocks/:id', ensureAuthenticated, (req: any, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM trades WHERE stockId = ? AND userId = ?').run(id, req.user.id);
    db.prepare('DELETE FROM stocks WHERE id = ? AND userId = ?').run(id, req.user.id);
    res.json({ success: true });
  });

  // --- Trade API ---
  app.get('/api/trades', ensureAuthenticated, (req: any, res) => {
    const trades = db.prepare('SELECT * FROM trades WHERE userId = ? ORDER BY date DESC').all(req.user.id);
    res.json(trades);
  });

  app.post('/api/trades', ensureAuthenticated, (req: any, res) => {
    const trade = { ...req.body, id: crypto.randomUUID(), userId: req.user.id };
    const insert = db.prepare(`
      INSERT INTO trades (id, stockId, type, shares, price, date, notes, userId)
      VALUES (@id, @stockId, @type, @shares, @price, @date, @notes, @userId)
    `);
    insert.run(trade);
    res.json(trade);
  });

  app.patch('/api/trades/:id', ensureAuthenticated, (req: any, res) => {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    const update = db.prepare(`UPDATE trades SET ${fields} WHERE id = @id AND userId = @userId`);
    update.run({ ...updates, id, userId: req.user.id });
    res.json({ success: true });
  });

  app.delete('/api/trades/:id', ensureAuthenticated, (req: any, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM trades WHERE id = ? AND userId = ?').run(id, req.user.id);
    res.json({ success: true });
  });

  // API Route for Stock Prices (Yahoo Finance)
  app.get('/api/stock/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { date } = req.query;
      // Thai stocks in Yahoo Finance use the .BK suffix
      const ticker = symbol.endsWith('.BK') ? symbol : `${symbol}.BK`;
      
      const [quote, summary, history] = await Promise.all([
        yf.quote(ticker),
        yf.quoteSummary(ticker, { 
          modules: ['assetProfile', 'price', 'defaultKeyStatistics', 'summaryDetail'] 
        }).catch(() => null),
        yf.chart(ticker, {
          period1: new Date(new Date().setFullYear(new Date().getFullYear() - 2)),
          period2: new Date(),
          interval: '1mo'
        }).catch(() => null)
      ]) as any;
      
      let historicalHigh = null;
      if (date) {
        try {
          const targetDate = new Date(date as string);
          const nextDate = new Date(targetDate);
          nextDate.setDate(nextDate.getDate() + 1);
          
          const chart = await yf.chart(ticker, { 
            period1: targetDate, 
            period2: nextDate, 
            interval: '1d' 
          });
          
          if (chart && chart.quotes && chart.quotes.length > 0) {
            historicalHigh = chart.quotes[0].high;
          }
        } catch (e) {
          console.error('Historical fetch error:', e);
        }
      }

      if (quote && quote.regularMarketPrice) {
        const website = summary?.assetProfile?.website;
        let domain = '';
        if (website) {
          try {
            domain = new URL(website).hostname.replace('www.', '');
          } catch (e) {
            domain = '';
          }
        }

        const history2Y = history?.quotes?.map((q: any) => ({
          date: q.date.toISOString().split('T')[0],
          price: q.close
        })).filter((q: any) => q.price != null) || [];

        res.json({ 
          price: quote.regularMarketPrice,
          name: quote.longName || quote.shortName || (summary?.price?.longName),
          website: website,
          domain: domain,
          high: historicalHigh || quote.regularMarketDayHigh,
          industry: summary?.assetProfile?.industry,
          pe: summary?.defaultKeyStatistics?.trailingPE || summary?.defaultKeyStatistics?.forwardPE,
          pbv: summary?.defaultKeyStatistics?.priceToBook,
          marketCap: summary?.price?.marketCap,
          freeFloat: summary?.defaultKeyStatistics?.floatShares,
          dividendYield: summary?.summaryDetail?.dividendYield,
          history2Y: history2Y
        });
      } else {
        res.status(404).json({ error: 'Stock not found' });
      }
    } catch (error) {
      console.error('Yahoo Finance Error:', error);
      res.status(500).json({ error: 'Failed to fetch stock price' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      app.get('*', (req, res) => {
        res.send('Application is building... Please refresh in a minute.');
      });
    }
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('GLOBAL ERROR:', err);
    res.status(500).send('Internal Server Error: ' + err.message);
  });
}

startServer();
