const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken, authMiddleware } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing?.isVerified) {
      return res.status(400).json({ error: 'Email already registered. Please log in.' });
    }
    const code = generateCode();
    const hashed = await bcrypt.hash(password, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    if (existing) {
      existing.name = name.trim();
      existing.password = hashed;
      existing.verificationCode = code;
      existing.verificationExpires = expires;
      await existing.save();
    } else {
      await User.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashed,
        verificationCode: code,
        verificationExpires: expires,
      });
    }

    await sendVerificationEmail(email.toLowerCase().trim(), name.trim(), code);
    res.status(201).json({ message: 'Confirmation code sent to your email', email: email.toLowerCase().trim() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) {
      const token = signToken(user._id);
      return res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
    }
    if (user.verificationCode !== code.trim()) {
      return res.status(400).json({ error: 'Invalid confirmation code' });
    }
    if (user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    await user.save();

    const token = signToken(user._id);
    res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/resend
router.post('/resend', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'Already verified. Please log in.' });

    const code = generateCode();
    user.verificationCode = code;
    user.verificationExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    await sendVerificationEmail(user.email, user.name, code);
    res.json({ message: 'New code sent' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.isVerified) {
      return res.status(403).json({ error: 'Email not verified', needsVerification: true, email: user.email });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user._id);
    res.json({ token, user: { _id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: { _id: req.user._id, name: req.user.name, email: req.user.email } });
});

module.exports = router;
