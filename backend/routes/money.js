const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { owned } = require('../utils/scope');
const { serialize } = require('../utils/serialize');

const TYPES = ['gave', 'received'];
const flip = (type) => (type === 'gave' ? 'received' : 'gave');

function balanceOf(transactions) {
  return transactions.reduce((sum, t) => sum + (t.type === 'gave' ? t.amount : -t.amount), 0);
}

router.get('/summary', async (req, res) => {
  try {
    const transactions = await prisma.moneyTransaction.findMany({ where: { userId: req.user.id } });
    const net = balanceOf(transactions);
    res.json({ owedToMe: Math.max(net, 0), iOwe: Math.max(-net, 0), net });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/friends', async (req, res) => {
  try {
    const friends = await prisma.moneyFriend.findMany({
      where: { userId: req.user.id },
      include: { transactions: true },
      orderBy: { createdAt: 'desc' },
    });
    const withBalance = friends.map((f) => {
      const { transactions, ...rest } = f;
      const lastActivity = transactions.reduce(
        (max, t) => (t.createdAt > max ? t.createdAt : max),
        f.createdAt
      );
      return { ...rest, balance: balanceOf(transactions), transactionCount: transactions.length, lastActivity };
    });
    withBalance.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    res.json(serialize(withBalance));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/friends', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const email = (req.body.email || '').toLowerCase().trim() || null;

    if (email && email === req.user.email) {
      return res.status(400).json({ error: "That's your own email" });
    }

    let linkedUserId = null;
    let mirrorFriendId = null;

    if (email) {
      const linkedUser = await prisma.user.findUnique({ where: { email } });
      if (linkedUser?.isVerified) {
        linkedUserId = linkedUser.id;
        let reciprocal = await prisma.moneyFriend.findFirst({
          where: { userId: linkedUser.id, linkedUserId: req.user.id },
        });
        if (!reciprocal) {
          reciprocal = await prisma.moneyFriend.create({
            data: {
              userId: linkedUser.id,
              name: req.user.name,
              email: req.user.email,
              linkedUserId: req.user.id,
            },
          });
        }
        mirrorFriendId = reciprocal.id;
      }
    }

    const friend = await prisma.moneyFriend.create({
      data: { userId: req.user.id, name, email, linkedUserId, mirrorFriendId },
    });

    if (mirrorFriendId) {
      await prisma.moneyFriend.update({
        where: { id: mirrorFriendId },
        data: { mirrorFriendId: friend.id },
      });
    }

    res.status(201).json(serialize({ ...friend, balance: 0, transactionCount: 0, lastActivity: friend.createdAt }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/friends/:id', async (req, res) => {
  try {
    const friend = await prisma.moneyFriend.findFirst({ where: owned(req, { _id: req.params.id }) });
    if (!friend) return res.status(404).json({ error: 'Friend not found' });
    if (friend.mirrorFriendId) {
      await prisma.moneyFriend.updateMany({
        where: { id: friend.mirrorFriendId },
        data: { mirrorFriendId: null, linkedUserId: null },
      });
    }
    await prisma.moneyFriend.delete({ where: { id: friend.id } });
    res.json({ message: 'Friend deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/friends/:id/transactions', async (req, res) => {
  try {
    const friend = await prisma.moneyFriend.findFirst({ where: owned(req, { _id: req.params.id }) });
    if (!friend) return res.status(404).json({ error: 'Friend not found' });
    const transactions = await prisma.moneyTransaction.findMany({
      where: { friendId: friend.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(serialize(transactions));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/friends/:id/transactions', async (req, res) => {
  try {
    const friend = await prisma.moneyFriend.findFirst({ where: owned(req, { _id: req.params.id }) });
    if (!friend) return res.status(404).json({ error: 'Friend not found' });

    const { type } = req.body;
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'type must be "gave" or "received"' });
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    const note = (req.body.note || '').trim();

    const txn = await prisma.moneyTransaction.create({
      data: { userId: req.user.id, friendId: friend.id, type, amount, note },
    });

    let mirrorId = null;
    if (friend.linkedUserId && friend.mirrorFriendId) {
      const mirrorTxn = await prisma.moneyTransaction.create({
        data: {
          userId: friend.linkedUserId,
          friendId: friend.mirrorFriendId,
          type: flip(type),
          amount,
          note,
          mirrorTransactionId: txn.id,
        },
      });
      mirrorId = mirrorTxn.id;
      await prisma.moneyTransaction.update({ where: { id: txn.id }, data: { mirrorTransactionId: mirrorId } });
    }

    res.status(201).json(serialize({ ...txn, mirrorTransactionId: mirrorId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/transactions/:id', async (req, res) => {
  try {
    const txn = await prisma.moneyTransaction.findFirst({ where: owned(req, { _id: req.params.id }) });
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const data = {};
    if (req.body.amount !== undefined) {
      const amount = Number(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
      }
      data.amount = amount;
    }
    if (req.body.note !== undefined) data.note = String(req.body.note).trim();
    if (req.body.type !== undefined) {
      if (!TYPES.includes(req.body.type)) return res.status(400).json({ error: 'Invalid type' });
      data.type = req.body.type;
    }

    const updated = await prisma.moneyTransaction.update({ where: { id: txn.id }, data });

    if (txn.mirrorTransactionId) {
      const mirrorData = {};
      if (data.amount !== undefined) mirrorData.amount = data.amount;
      if (data.note !== undefined) mirrorData.note = data.note;
      if (data.type !== undefined) mirrorData.type = flip(data.type);
      if (Object.keys(mirrorData).length) {
        await prisma.moneyTransaction.updateMany({ where: { id: txn.mirrorTransactionId }, data: mirrorData });
      }
    }

    res.json(serialize(updated));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const txn = await prisma.moneyTransaction.findFirst({ where: owned(req, { _id: req.params.id }) });
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    if (txn.mirrorTransactionId) {
      await prisma.moneyTransaction.deleteMany({ where: { id: txn.mirrorTransactionId } });
    }
    await prisma.moneyTransaction.delete({ where: { id: txn.id } });
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
