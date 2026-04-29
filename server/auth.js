import jwt from 'jsonwebtoken';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as GitHubStrategy } from 'passport-github2';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function requireAuth(req, res, next) {
  if (req.user?.id) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const token = header.slice('Bearer '.length);
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function upsertOAuthUser({ provider, providerId, email, displayName, avatarUrl }) {
  let user = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId);
  if (!user && email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  }

  if (!user) {
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, provider, provider_id, display_name, avatar_url) VALUES (?, NULL, ?, ?, ?, ?)'
    ).run(email?.toLowerCase() || null, provider, providerId, displayName || null, avatarUrl || null);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  } else {
    db.prepare('UPDATE users SET provider = ?, provider_id = ?, display_name = ?, avatar_url = ? WHERE id = ?')
      .run(provider, providerId, displayName || user.display_name, avatarUrl || user.avatar_url, user.id);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  }

  return user;
}

function oauthEnabled(envKeys = []) {
  return envKeys.every((key) => Boolean(process.env[key]));
}

export function configurePassport() {
  if (oauthEnabled(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APP_BASE_URL'])) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.APP_BASE_URL}/api/auth/google/callback`
    }, (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = upsertOAuthUser({
          provider: 'google',
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          displayName: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value
        });
        done(null, user);
      } catch (e) {
        done(e);
      }
    }));
  }

  if (oauthEnabled(['FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET', 'APP_BASE_URL'])) {
    passport.use(new FacebookStrategy({
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: `${process.env.APP_BASE_URL}/api/auth/facebook/callback`,
      profileFields: ['id', 'emails', 'name', 'displayName', 'photos']
    }, (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = upsertOAuthUser({
          provider: 'facebook',
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          displayName: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`,
          avatarUrl: profile.photos?.[0]?.value
        });
        done(null, user);
      } catch (e) {
        done(e);
      }
    }));
  }

  if (oauthEnabled(['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'APP_BASE_URL'])) {
    passport.use(new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.APP_BASE_URL}/api/auth/github/callback`,
      scope: ['user:email']
    }, (_accessToken, _refreshToken, profile, done) => {
      try {
        const user = upsertOAuthUser({
          provider: 'github',
          providerId: profile.id,
          email: profile.emails?.[0]?.value,
          displayName: profile.displayName || profile.username,
          avatarUrl: profile.photos?.[0]?.value
        });
        done(null, user);
      } catch (e) {
        done(e);
      }
    }));
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    done(null, user || false);
  });

  return passport;
}
