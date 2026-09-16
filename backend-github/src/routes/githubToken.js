import { Router } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import axios from 'axios';
import GithubToken from '../models/GithubToken.js';
import { encryptToken, decryptToken } from '../utils/encryption.js';

const router = Router();
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Middleware to verify Clerk session token and attach userId
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const verified = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    req.userId = verified.sub;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

// POST: Save or replace GitHub token
router.post('/', requireAuth, async (req, res) => {
  const { githubToken } = req.body;
  
  if (!githubToken) {
    return res.status(400).json({ success: false, error: 'GitHub token is required' });
  }

  const trimmedToken = githubToken.trim();

  // Validate the token with GitHub before storing
  try {
    await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${trimmedToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'UX-Auditor',
      },
      timeout: 8000,
    });
  } catch (err) {
    if (err.response?.status === 401) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GitHub token: GitHub rejected the token (401 Bad credentials). Please verify your token is active and not expired.',
      });
    }
  }

  try {
    const encryptedToken = encryptToken(trimmedToken);
    
    // Update if exists, otherwise create
    await GithubToken.findOneAndUpdate(
      { userId: req.userId },
      { encryptedToken, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, message: 'Token saved securely' });
  } catch (err) {
    console.error('Failed to save GitHub token:', err.message);
    res.status(500).json({ success: false, error: 'Failed to save token securely. Check server logs.' });
  }
});

// GET: Check connection status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const tokenDoc = await GithubToken.findOne({ userId: req.userId });
    if (!tokenDoc) {
      return res.json({ success: true, isConnected: false });
    }

    // Verify if stored token is still active and valid
    try {
      const decrypted = decryptToken(tokenDoc.encryptedToken);
      await axios.get('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${decrypted}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'UX-Auditor',
        },
        timeout: 5000,
      });
      res.json({ success: true, isConnected: true });
    } catch (ghErr) {
      if (ghErr.response?.status === 401) {
        console.warn(`Stored GitHub token for user ${req.userId} is expired or invalid. Auto-removing from database.`);
        await GithubToken.findOneAndDelete({ userId: req.userId });
        return res.json({ success: true, isConnected: false, expired: true });
      }
      res.json({ success: true, isConnected: true });
    }
  } catch (err) {
    console.error('Failed to check token status:', err.message);
    res.status(500).json({ success: false, error: 'Failed to check connection status' });
  }
});

// DELETE: Remove token
router.delete('/', requireAuth, async (req, res) => {
  try {
    await GithubToken.findOneAndDelete({ userId: req.userId });
    res.json({ success: true, message: 'Token removed successfully' });
  } catch (err) {
    console.error('Failed to delete GitHub token:', err.message);
    res.status(500).json({ success: false, error: 'Failed to remove token' });
  }
});

export default router;
