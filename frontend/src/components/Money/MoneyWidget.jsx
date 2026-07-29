import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IndianRupee, X, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMoneyFriends, createMoneyFriend, addMoneyTransaction, getMoneySummary,
} from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import './MoneyWidget.css';

function fmt(n) {
  return Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function MoneyWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [summary, setSummary] = useState(null);
  const [type, setType] = useState('gave');
  const [friendId, setFriendId] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, s] = await Promise.all([getMoneyFriends(), getMoneySummary()]);
      setFriends(f);
      setSummary(s);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!user) return null;

  const resetForm = () => {
    setFriendId('');
    setAddingNew(false);
    setNewName('');
    setNewEmail('');
    setAmount('');
    setNote('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }

    setSaving(true);
    try {
      let targetId = friendId;
      if (addingNew) {
        if (!newName.trim()) { toast.error('Friend name is required'); setSaving(false); return; }
        const friend = await createMoneyFriend({ name: newName.trim(), email: newEmail.trim() || undefined });
        targetId = friend._id;
      }
      if (!targetId) { toast.error('Pick or add a friend'); setSaving(false); return; }

      await addMoneyTransaction(targetId, { type, amount: amt, note: note.trim() });
      toast.success(type === 'gave' ? 'Logged — you gave money' : 'Logged — you received money');
      resetForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const net = summary?.net || 0;
  const topFriends = [...friends].slice(0, 4);

  return (
    <>
      {open && (
        <div className="money-widget-panel">
          <div className="money-widget-head">
            <div className="money-widget-title">
              <IndianRupee size={16} />
              <span>Money</span>
            </div>
            <button className="money-widget-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <form className="money-widget-form" onSubmit={handleSubmit}>
            <div className="money-type-toggle">
              <button
                type="button"
                className={`money-type-btn ${type === 'gave' ? 'active gave' : ''}`}
                onClick={() => setType('gave')}
              >
                <ArrowUpRight size={14} /> Send
              </button>
              <button
                type="button"
                className={`money-type-btn ${type === 'received' ? 'active received' : ''}`}
                onClick={() => setType('received')}
              >
                <ArrowDownLeft size={14} /> Receive
              </button>
            </div>

            {!addingNew ? (
              <div className="money-friend-row">
                <select
                  className="money-friend-select"
                  value={friendId}
                  onChange={(e) => setFriendId(e.target.value)}
                >
                  <option value="">Select friend...</option>
                  {friends.map((f) => (
                    <option key={f._id} value={f._id}>{f.name}</option>
                  ))}
                </select>
                <button type="button" className="money-add-friend-btn" onClick={() => setAddingNew(true)}>
                  <Plus size={13} /> New
                </button>
              </div>
            ) : (
              <div className="money-new-friend">
                <input
                  placeholder="Friend's name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
                <input
                  type="email"
                  placeholder="Gmail (optional — syncs if they use SortLife)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <button type="button" className="money-cancel-new" onClick={() => setAddingNew(false)}>
                  Use existing friend instead
                </button>
              </div>
            )}

            <div className="money-amount-row">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <input
              className="money-note-input"
              placeholder="What's this for? (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button type="submit" className="btn btn-primary money-submit-btn" disabled={saving}>
              {saving ? 'Saving...' : type === 'gave' ? 'Log money sent' : 'Log money received'}
            </button>
          </form>

          {topFriends.length > 0 && (
            <div className="money-widget-list">
              {topFriends.map((f) => (
                <div key={f._id} className="money-widget-row" onClick={() => { setOpen(false); navigate('/money'); }}>
                  <span className="money-widget-avatar">{f.name.charAt(0).toUpperCase()}</span>
                  <span className="money-widget-name">{f.name}</span>
                  <span className={`money-widget-balance ${f.balance >= 0 ? 'positive' : 'negative'}`}>
                    {f.balance === 0 ? 'settled' : `${f.balance > 0 ? 'owes you' : 'you owe'} ${fmt(f.balance)}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="money-view-all" onClick={() => { setOpen(false); navigate('/money'); }}>
            View all →
          </button>
        </div>
      )}

      <button
        type="button"
        className="money-fab"
        onClick={() => setOpen((v) => !v)}
        title="Send / receive money"
      >
        <IndianRupee size={20} />
        {net !== 0 && (
          <span className={`money-fab-badge ${net > 0 ? 'positive' : 'negative'}`} />
        )}
      </button>
    </>
  );
}
