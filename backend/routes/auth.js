const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken, authMiddleware } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/email');
const { serialize } = require('../utils/serialize');

const router = express.Router();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function publicUser(user) {
  return { _id: user.id, name: user.name, email: user.email };
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
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing?.isVerified) {
      return res.status(400).json({ error: 'Email already registered. Please log in.' });
    }
    const code = generateCode();
    const hashed = await bcrypt.hash(password, 10);
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: name.trim(),
          password: hashed,
          verificationCode: code,
          verificationExpires: expires,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashed,
          verificationCode: code,
          verificationExpires: expires,
        },
      });
    }

    res.status(201).json({
      message: 'Account created. Check your email for the confirmation code.',
      email: normalizedEmail,
    });

    sendVerificationEmail(normalizedEmail, name.trim(), code).then((result) => {
      if (!result.sent) console.warn('Signup email not delivered:', result.reason);
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(400).json({ error: err.message || 'Signup failed' });
  }
});

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) {
      const token = signToken(user.id);
      return res.json({ token, user: publicUser(user) });
    }
    if (user.verificationCode !== code.trim()) {
      return res.status(400).json({ error: 'Invalid confirmation code' });
    }
    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Code expired. Request a new one.' });
    }

    const verified = await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationCode: null, verificationExpires: null },
    });

    const token = signToken(verified.id);
    res.json({ token, user: publicUser(verified) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/resend
router.post('/resend', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email?.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.isVerified) return res.status(400).json({ error: 'Already verified. Please log in.' });

    const code = generateCode();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: code,
        verificationExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    res.json({ message: 'New code sent' });

    sendVerificationEmail(user.email, user.name, code).then((result) => {
      if (!result.sent) console.warn('Resend email not delivered:', result.reason);
    });
  } catch (err) {
    console.error('Resend error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.isVerified) {
      return res.status(403).json({ error: 'Email not verified', needsVerification: true, email: user.email });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
