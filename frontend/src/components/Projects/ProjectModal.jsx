import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Link, User, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { createProject, updateProject } from '../../utils/api';
import './ProjectModal.css';

const PROJECT_COLORS = [
  '', '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

const defaultForm = {
  title: '',
  description: '',
  status: 'active',
  priority: 'medium',
  progress: 0,
  dueDate: '',
  tags: '',
  color: '',
};

export default function ProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState(defaultForm);
  const [tasks, setTasks] = useState([]);
  const [taskInput, setTaskInput] = useState('');
  const [links, setLinks] = useState([]);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('details'); // details | tasks | links
  const isEdit = Boolean(project);

  useEffect(() => {
    if (project) {
      setForm({
        title: project.title || '',
        description: project.description || '',
        status: project.status || 'active',
        priority: project.priority || 'medium',
        progress: project.progress ?? 0,
        dueDate: project.dueDate ? project.dueDate.slice(0, 10) : '',
        tags: project.tags ? project.tags.join(', ') : '',
        color: project.color || '',
      });
      setTasks(project.tasks ? project.tasks.map((t) => ({ ...t })) : []);
      setLinks(project.links ? project.links.map((l) => ({ ...l })) : []);
      setAssignees(project.assignees ? [...project.assignees] : []);
    } else {
      setForm(defaultForm);
      setTasks([]);
      setLinks([]);
      setAssignees([]);
    }
  }, [project]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const addTask = () => {
    if (!taskInput.trim()) return;
    setTasks((prev) => [...prev, { id: crypto.randomUUID(), text: taskInput.trim(), done: false }]);
    setTaskInput('');
  };

  const toggleTask = (id) =>
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done } : t));

  const removeTask = (id) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  const addLink = () => {
    if (!linkUrl.trim()) return;
    setLinks((prev) => [...prev, { id: crypto.randomUUID(), label: linkLabel.trim() || linkUrl.trim(), url: linkUrl.trim() }]);
    setLinkLabel('');
    setLinkUrl('');
  };

  const removeLink = (id) => setLinks((prev) => prev.filter((l) => l.id !== id));

  const addAssignee = () => {
    if (!assigneeInput.trim()) return;
    setAssignees((prev) => [...prev, assigneeInput.trim()]);
    setAssigneeInput('');
  };

  const removeAssignee = (i) => setAssignees((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        progress: Number(form.progress),
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        dueDate: form.dueDate || undefined,
        tasks,
        links,
        assignees,
      };
      if (isEdit) {
        await updateProject(project._id, payload);
        toast.success('Project updated!');
      } else {
        await createProject(payload);
        toast.success('Project created!');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const completedTasks = tasks.filter((t) => t.done).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card project-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Project' : 'New Project'}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="pm-tabs">
          {['details', 'tasks', 'links'].map((t) => (
            <button
              key={t}
              className={`pm-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'tasks' ? `Tasks (${completedTasks}/${tasks.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === 'details' && (
            <>
              <div className="form-group">
                <label>Title *</label>
                <input name="title" value={form.title} onChange={handleChange} placeholder="Project title..." autoFocus />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} placeholder="What is this project about?" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={form.status} onChange={handleChange}>
                    <option value="active">Active</option>
                    <option value="planned">Planned</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Priority</label>
                  <select name="priority" value={form.priority} onChange={handleChange}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Progress: {form.progress}%</label>
                <input type="range" name="progress" min="0" max="100" value={form.progress} onChange={handleChange} className="progress-slider" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Due Date</label>
                  <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Tags (comma separated)</label>
                  <input name="tags" value={form.tags} onChange={handleChange} placeholder="react, backend..." />
                </div>
              </div>
              <div className="form-group">
                <label>Card Color</label>
                <div className="color-picker">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                      style={{ background: c || 'var(--bg-hover)', border: c ? `2px solid ${c}` : '2px solid var(--border)' }}
                      onClick={() => setForm((p) => ({ ...p, color: c }))}
                      title={c || 'Default'}
                    />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Assignees</label>
                <div className="assignee-row">
                  <input
                    value={assigneeInput}
                    onChange={(e) => setAssigneeInput(e.target.value)}
                    placeholder="Name or @handle..."
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAssignee(); } }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addAssignee}>
                    <Plus size={13} />
                  </button>
                </div>
                <div className="assignee-list">
                  {assignees.map((a, i) => (
                    <span key={i} className="assignee-chip">
                      <User size={11} /> {a}
                      <button type="button" onClick={() => removeAssignee(i)}><X size={10} /></button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'tasks' && (
            <div className="pm-tasks">
              <div className="task-add-row">
                <input
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Add a task..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                  autoFocus
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={addTask}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {tasks.length === 0 && (
                <p className="pm-empty">No tasks yet. Add some above.</p>
              )}
              <ul className="task-list">
                {tasks.map((task) => (
                  <li key={task.id} className={`task-item ${task.done ? 'done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span>{task.text}</span>
                    <button type="button" className="task-remove" onClick={() => removeTask(task.id)}>
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
              {tasks.length > 0 && (
                <div className="task-progress-bar">
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round((completedTasks / tasks.length) * 100)}%` }}
                    />
                  </div>
                  <span className="task-progress-label">{completedTasks}/{tasks.length} done</span>
                </div>
              )}
            </div>
          )}

          {tab === 'links' && (
            <div className="pm-links">
              <div className="link-add-form">
                <input
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Label (optional)..."
                />
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={addLink}>
                  <Plus size={13} /> Add
                </button>
              </div>
              {links.length === 0 && <p className="pm-empty">No links yet.</p>}
              <ul className="link-list">
                {links.map((l) => (
                  <li key={l.id} className="link-item">
                    <Link size={13} color="var(--accent-blue)" />
                    <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
                    <button type="button" className="task-remove" onClick={() => removeLink(l.id)}>
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
