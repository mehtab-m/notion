import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ArrowLeft, ArrowUpRight, ArrowDownLeft, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import {
  getMoneyFriends, createMoneyFriend, deleteMoneyFriend,
  getMoneyTransactions, addMoneyTransaction, deleteMoneyTransaction,
} from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';
import '../components/Money/MoneyWidget.css';
import './MoneyPage.css';

function fmt(n) {
  return Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function AddFriendForm({ onAdded, onCancel }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const friend = await createMoneyFriend({ name: name.trim(), email: email.trim() || undefined });
      toast.success(friend.linkedUserId ? `Linked with ${friend.name} on SortLife` : 'Friend added');
      onAdded(friend);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add friend');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="money-add-friend-form" onSubmit={handleSubmit}>
      <input placeholder="Friend's name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input
        type="email"
        placeholder="Gmail (optional — syncs both ledgers if they use SortLife)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="money-add-friend-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Adding...' : 'Add friend'}
        </button>
      </div>
    </form>
  );
}

function FriendLedger({ friend, onBack, onChanged, onDeleted }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('gave');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMoneyTransactions(friend._id);
      setTransactions(data);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [friend._id]);

  useEffect(() => { load(); }, [load]);

  const balance = transactions.reduce((sum, t) => sum + (t.type === 'gave' ? t.amount : -t.amount), 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      await addMoneyTransaction(friend._id, { type, amount: amt, note: note.trim() });
      setAmount('');
      setNote('');
      await load();
      onChanged();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTxn = async (id) => {
    try {
      await deleteMoneyTransaction(id);
      await load();
      onChanged();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <section className="money-ledger">
      <div className="money-ledger-head">
        <button className="money-back-btn" onClick={onBack}><ArrowLeft size={16} /> Back to friends</button>
        <button className="money-icon-btn danger" onClick={() => setConfirmDelete(true)} title="Remove friend">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="money-ledger-hero">
        <span className="money-widget-avatar money-ledger-avatar">{friend.name.charAt(0).toUpperCase()}</span>
        <div>
          <h2>{friend.name}</h2>
          {friend.email && <p className="money-ledger-email">{friend.email}{friend.linkedUserId && ' · SortLife member, synced'}</p>}
        </div>
        <div className={`money-ledger-balance ${balance >= 0 ? 'positive' : 'negative'}`}>
          {balance === 0 ? 'Settled up' : balance > 0 ? `Owes you ${fmt(balance)}` : `You owe ${fmt(balance)}`}
        </div>
      </div>

      <form className="money-ledger-form" onSubmit={handleAdd}>
        <div className="money-type-toggle">
          <button type="button" className={`money-type-btn ${type === 'gave' ? 'active gave' : ''}`} onClick={() => setType('gave')}>
            <ArrowUpRight size={14} /> Send
          </button>
          <button type="button" className={`money-type-btn ${type === 'received' ? 'active received' : ''}`} onClick={() => setType('received')}>
            <ArrowDownLeft size={14} /> Receive
          </button>
        </div>
        <input type="number" min="0.01" step="0.01" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving...' : 'Log'}
        </button>
      </form>

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : transactions.length === 0 ? (
        <div className="money-empty"><Users size={36} strokeWidth={1} /><p>No transactions yet</p></div>
      ) : (
        <div className="money-ledger-list">
          {transactions.map((t) => {
            const mine = t.type === 'gave';
            return (
              <div key={t._id} className={`money-ledger-row ${mine ? 'mine' : 'theirs'}`}>
                <div className="money-ledger-entry">
                  <div className="money-ledger-entry-top">
                    <span>{mine ? `You sent ${friend.name}` : `You received from ${friend.name}`}</span>
                    <button type="button" className="money-ledger-delete" onClick={() => handleDeleteTxn(t._id)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <strong>{fmt(t.amount)}</strong>
                  {t.note && <p>{t.note}</p>}
                  <time>{format(new Date(t.createdAt), 'MMM d, yyyy · h:mm a')}</time>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Remove friend?"
        message="This deletes their ledger on your side. If they're a linked SortLife member, their own history stays but stops syncing with you."
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          setConfirmDelete(false);
          try {
            await deleteMoneyFriend(friend._id);
            toast.success('Friend removed');
            onDeleted();
          } catch {
            toast.error('Failed to remove friend');
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}

export default function MoneyPage() {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showAddFriend, setShowAddFriend] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMoneyFriends();
      setFriends(data);
    } catch {
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) return;
    const fresh = friends.find((f) => f._id === selected._id);
    if (fresh) setSelected(fresh);
  }, [friends, selected]);

  const totalOwedToMe = friends.reduce((sum, f) => sum + Math.max(f.balance, 0), 0);
  const totalIOwe = friends.reduce((sum, f) => sum + Math.max(-f.balance, 0), 0);

  if (selected) {
    return (
      <div className="money-page">
        <FriendLedger
          friend={selected}
          onBack={() => setSelected(null)}
          onChanged={load}
          onDeleted={() => { setSelected(null); load(); }}
        />
      </div>
    );
  }

  return (
    <div className="money-page">
      <div className="page-header">
        <div>
          <h1>Money</h1>
          <p className="tables-page-subtitle">Track who you gave money to and who owes you back</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddFriend(true)}>
          <Plus size={16} /> Add friend
        </button>
      </div>

      <div className="money-summary-bar">
        <div className="money-summary-card positive">
          <span>Owed to you</span>
          <strong>{fmt(totalOwedToMe)}</strong>
        </div>
        <div className="money-summary-card negative">
          <span>You owe</span>
          <strong>{fmt(totalIOwe)}</strong>
        </div>
      </div>

      {showAddFriend && (
        <AddFriendForm
          onAdded={(friend) => { setShowAddFriend(false); load(); setSelected(friend); }}
          onCancel={() => setShowAddFriend(false)}
        />
      )}

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : friends.length === 0 ? (
        <div className="empty-state">
          <Users size={48} strokeWidth={1} />
          <h3>No friends yet</h3>
          <p>Add a friend to start tracking who owes who.</p>
        </div>
      ) : (
        <div className="money-friends-grid">
          {friends.map((f) => (
            <button key={f._id} type="button" className="money-friend-card" onClick={() => setSelected(f)}>
              <span className="money-widget-avatar money-friend-card-avatar">{f.name.charAt(0).toUpperCase()}</span>
              <div className="money-friend-card-body">
                <strong>{f.name}</strong>
                {f.linkedUserId && <span className="money-friend-synced">Synced · SortLife</span>}
              </div>
              <span className={`money-widget-balance ${f.balance >= 0 ? 'positive' : 'negative'}`}>
                {f.balance === 0 ? 'settled' : `${f.balance > 0 ? 'owes you' : 'you owe'} ${fmt(f.balance)}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
