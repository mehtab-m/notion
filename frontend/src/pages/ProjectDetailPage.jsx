import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Plus, Trash2, ChevronDown, ChevronRight,
  Users, CheckSquare, Database, User, MessageSquare, Mail,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  getProject, updateProject, deleteProject,
  inviteProjectMember, removeProjectMember, acceptProjectInvite,
  addProjectTask, toggleProjectTask, deleteProjectTask,
  addProjectSubtask, toggleProjectSubtask, deleteProjectSubtask, updateProjectTask, updateProjectSubtask,
  addProjectTable, deleteProjectTable,
  addProjectTableRow, updateProjectTableRow, deleteProjectTableRow,
  addProjectTableColumn, updateProjectTableColumn, deleteProjectTableColumn,
  getProjectMessages, sendProjectMessage,
} from '../utils/api';
import TableBoard from '../components/Tables/TableBoard';
import './ProjectDetailPage.css';

const TABLE_TEMPLATES = [
  {
    name: 'Subscriptions',
    columns: [
      { name: 'Service', type: 'text' },
      { name: 'Cost / Month', type: 'number' },
      { name: 'Billing Cycle', type: 'dropdown', options: ['Monthly', 'Yearly', 'Weekly'] },
      { name: 'Renewal Date', type: 'date' },
      { name: 'Status', type: 'dropdown', options: ['Active', 'Paused', 'Cancelled'] },
      { name: 'Notes', type: 'text' },
    ],
  },
  {
    name: 'Passkeys',
    columns: [
      { name: 'Label', type: 'text' },
      { name: 'Username', type: 'text' },
      { name: 'Password / Key', type: 'text' },
      { name: 'URL', type: 'url' },
      { name: 'Notes', type: 'text' },
    ],
  },
  {
    name: 'API Keys',
    columns: [
      { name: 'Service', type: 'text' },
      { name: 'API Key', type: 'text' },
      { name: 'Environment', type: 'dropdown', options: ['Production', 'Staging', 'Dev'] },
      { name: 'Expires', type: 'date' },
      { name: 'Notes', type: 'text' },
    ],
  },
  {
    name: 'Credentials',
    columns: [
      { name: 'Name', type: 'text' },
      { name: 'Username', type: 'text' },
      { name: 'Password', type: 'text' },
      { name: 'URL', type: 'url' },
      { name: 'Notes', type: 'text' },
    ],
  },
];

function TaskComments({ projectId, taskId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getProjectMessages(projectId, taskId);
      setMessages(data);
    } catch { /* silent */ }
  }, [projectId, taskId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await sendProjectMessage(projectId, { text: text.trim(), taskId });
      setText('');
      load();
    } catch {
      toast.error('Failed to send');
    }
  };

  return (
    <div className="pd-task-comments">
      <div className="pd-comments-list">
        {messages.length === 0 ? (
          <p className="pd-comments-empty">No comments yet</p>
        ) : (
          messages.map((m) => (
            <div key={m._id} className="pd-comment">
              <strong>{m.userName}</strong>
              <span>{m.text}</span>
              <time>{format(new Date(m.createdAt), 'MMM d, h:mm a')}</time>
            </div>
          ))
        )}
      </div>
      <div className="pd-comment-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Comment on this task..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

function ProjectChat({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getProjectMessages(projectId);
      setMessages(data);
    } catch { /* silent */ }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await sendProjectMessage(projectId, { text: text.trim() });
      setText('');
      load();
    } catch {
      toast.error('Failed to send');
    }
  };

  return (
    <div className="pd-chat-panel">
      <div className="pd-chat-messages">
        {messages.length === 0 ? (
          <div className="pd-empty"><MessageSquare size={36} strokeWidth={1} /><p>Start the project conversation</p></div>
        ) : (
          messages.map((m) => (
            <div key={m._id} className="pd-chat-bubble">
              <div className="pd-chat-bubble-head">
                <span className="pd-chat-author">{m.userName}</span>
                <time>{format(new Date(m.createdAt), 'MMM d, h:mm a')}</time>
              </div>
              <p>{m.text}</p>
            </div>
          ))
        )}
      </div>
      <div className="pd-chat-compose">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the team..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

function memberStatusLabel(status) {
  if (status === 'accepted') return 'Active';
  if (status === 'pending') return 'Pending';
  if (status === 'declined') return 'Declined';
  return status;
}

function memberStatusClass(status) {
  if (status === 'accepted') return 'ms-accepted';
  if (status === 'pending') return 'ms-pending';
  return 'ms-declined';
}
function AssigneeSelect({ team, value, onChange, disabled }) {
  if (!team.length) return null;
  return (
    <select className="assignee-select" value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">Unassigned</option>
      {team.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
}

function TaskItem({ task, team, projectId, onUpdate }) {
  const [expanded, setExpanded] = useState(true);
  const [subInput, setSubInput] = useState('');
  const [subAssignee, setSubAssignee] = useState('');

  const handleToggle = async () => {
    try {
      const updated = await toggleProjectTask(projectId, task.id);
      onUpdate(updated);
    } catch { toast.error('Failed'); }
  };

  const handleAssignee = async (assignee) => {
    try {
      const updated = await updateProjectTask(projectId, task.id, { assignee });
      onUpdate(updated);
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task and its subtasks?')) return;
    try {
      const updated = await deleteProjectTask(projectId, task.id);
      onUpdate(updated);
    } catch { toast.error('Failed'); }
  };

  const handleAddSub = async () => {
    if (!subInput.trim()) return;
    try {
      const updated = await addProjectSubtask(projectId, task.id, { text: subInput.trim(), assignee: subAssignee });
      onUpdate(updated);
      setSubInput('');
      setSubAssignee('');
    } catch { toast.error('Failed to add subtask'); }
  };

  const subtasks = task.subtasks || [];

  return (
    <div className={`pd-task ${task.done ? 'done' : ''}`}>
      <div className="pd-task-main">
        <button className="pd-expand-btn" onClick={() => setExpanded(!expanded)}>
          {subtasks.length > 0 ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="pd-expand-spacer" />}
        </button>
        <input type="checkbox" checked={task.done} onChange={handleToggle} />
        <span className="pd-task-text">{task.text}</span>
        <AssigneeSelect team={team} value={task.assignee} onChange={handleAssignee} />
        <button className="pd-icon-btn danger" onClick={handleDelete}><Trash2 size={13} /></button>
      </div>

      {expanded && subtasks.length > 0 && (
        <ul className="pd-subtask-list">
          {subtasks.map((sub) => (
            <li key={sub.id} className={`pd-subtask ${sub.done ? 'done' : ''}`}>
              <input
                type="checkbox"
                checked={sub.done}
                onChange={async () => {
                  try {
                    const updated = await toggleProjectSubtask(projectId, task.id, sub.id);
                    onUpdate(updated);
                  } catch { toast.error('Failed'); }
                }}
              />
              <span>{sub.text}</span>
              <AssigneeSelect
                team={team}
                value={sub.assignee}
                onChange={async (assignee) => {
                  try {
                    const updated = await updateProjectSubtask(projectId, task.id, sub.id, { assignee });
                    onUpdate(updated);
                  } catch { toast.error('Failed'); }
                }}
              />
              <button
                className="pd-icon-btn danger"
                onClick={async () => {
                  try {
                    const updated = await deleteProjectSubtask(projectId, task.id, sub.id);
                    onUpdate(updated);
                  } catch { toast.error('Failed'); }
                }}
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {expanded && (
        <>
          <TaskComments projectId={projectId} taskId={task.id} />
          <div className="pd-subtask-add">
          <input
            value={subInput}
            onChange={(e) => setSubInput(e.target.value)}
            placeholder="Add subtask..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddSub()}
          />
          <AssigneeSelect team={team} value={subAssignee} onChange={setSubAssignee} />
          <button className="btn btn-secondary btn-sm" onClick={handleAddSub}><Plus size={12} /></button>
        </div>
        </>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tasks');
  const [taskInput, setTaskInput] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [tableInput, setTableInput] = useState('');
  const [highlightTableId, setHighlightTableId] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const fetchProject = useCallback(async () => {
    try {
      const data = await getProject(id);
      setProject(data);
    } catch {
      toast.error('Project not found');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const team = project?.team || [];
  const members = project?.members || [];
  const isOwner = project?.isOwner !== false;
  const myPending = members.find((m) => m.email === user?.email && m.status === 'pending');

  const saveField = async (patch) => {
    try {
      const updated = await updateProject(id, { ...project, ...patch });
      setProject(updated);
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleAddTask = async () => {
    if (!taskInput.trim()) return;
    try {
      const updated = await addProjectTask(id, { text: taskInput.trim(), assignee: taskAssignee });
      setProject(updated);
      setTaskInput('');
      setTaskAssignee('');
      toast.success('Task added');
    } catch { toast.error('Failed'); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      const updated = await inviteProjectMember(id, inviteEmail.trim());
      setProject(updated);
      setInviteEmail('');
      toast.success('Invitation sent');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to invite');
    }
  };

  const handleAcceptMyInvite = async () => {
    if (!myPending) return;
    try {
      const updated = await acceptProjectInvite(myPending._id);
      setProject(updated);
      toast.success('You joined the project');
    } catch {
      toast.error('Failed to accept');
    }
  };

  const handleAddTable = async (templateOrName) => {
    let payload;
    if (typeof templateOrName === 'object' && templateOrName.name) {
      payload = {
        name: templateOrName.name,
        columns: templateOrName.columns.map((c) => ({
          id: crypto.randomUUID(),
          name: c.name,
          type: c.type || 'text',
          options: c.options || [],
        })),
      };
    } else {
      const tableName = (templateOrName || tableInput).trim();
      if (!tableName) return;
      payload = { name: tableName, columns: [] };
    }
    try {
      const updated = await addProjectTable(id, payload);
      setProject(updated);
      const newId = updated.dataTables[updated.dataTables.length - 1].id;
      setHighlightTableId(newId);
      setTableInput('');
      toast.success(`Table "${payload.name}" created`);
    } catch { toast.error('Failed'); }
  };

  const refreshProject = useCallback(async () => {
    try {
      const data = await getProject(id);
      setProject(data);
    } catch { /* silent */ }
  }, [id]);

  const getProjectTableApi = useCallback((tableId) => ({
    addRow: (_tableId, data) => addProjectTableRow(id, tableId, { data }),
    updateRow: (_tableId, rowId, data) => updateProjectTableRow(id, tableId, rowId, { data }),
    deleteRow: (_tableId, rowId) => deleteProjectTableRow(id, tableId, rowId),
    addColumn: (_tableId, col) => addProjectTableColumn(id, tableId, col),
    updateColumn: (_tableId, colId, data) => updateProjectTableColumn(id, tableId, colId, data),
    deleteColumn: (_tableId, colId) => deleteProjectTableColumn(id, tableId, colId),
  }), [id]);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;
  if (!project) return null;

  const dueDate = project.dueDate ? new Date(project.dueDate) : null;
  const overdue = dueDate && isPast(dueDate) && !isToday(dueDate) && project.status !== 'completed';
  const taskCount = (project.tasks || []).length;

  return (
    <div className="project-detail">
      <div className="pd-header">
        <button className="pd-back" onClick={() => navigate('/projects')}>
          <ArrowLeft size={16} /> Projects
        </button>

        <div className="pd-header-main">
          {editingTitle ? (
            <input
              className="pd-title-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft !== project.title) saveField({ title: titleDraft.trim() });
                setEditingTitle(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              autoFocus
            />
          ) : (
            <h1 className="pd-title" onClick={() => { setTitleDraft(project.title); setEditingTitle(true); }}>
              {project.title}
            </h1>
          )}

          <div className="pd-header-meta">
            <label className="pd-deadline">
              <Calendar size={14} />
              <input
                type="date"
                value={project.dueDate ? project.dueDate.slice(0, 10) : ''}
                onChange={(e) => saveField({ dueDate: e.target.value || undefined })}
              />
              {dueDate && (
                <span className={`pd-deadline-label ${overdue ? 'overdue' : ''}`}>
                  {format(dueDate, 'MMM d, yyyy')}
                  {overdue && ' · Overdue'}
                </span>
              )}
            </label>
            {taskCount > 0 && (
              <span className="pd-progress-badge">{project.progress}% done</span>
            )}
            <select
              className="pd-status-select"
              value={project.status}
              onChange={(e) => saveField({ status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="planned">Planned</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <button
          className="btn btn-danger btn-sm pd-delete-btn"
          onClick={async () => {
            if (!window.confirm('Delete this project permanently?')) return;
            await deleteProject(id);
            toast.success('Deleted');
            navigate('/projects');
          }}
          style={{ display: isOwner ? undefined : 'none' }}
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>

      <div className="pd-tabs">
        {[
          { id: 'tasks', icon: CheckSquare, label: `Tasks (${taskCount})` },
          { id: 'tables', icon: Database, label: `Data Tables (${(project.dataTables || []).length})` },
          { id: 'team', icon: Users, label: `Team (${members.length})` },
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
        ].map(({ id: tabId, icon: Icon, label }) => (
          <button
            key={tabId}
            className={`pd-tab ${tab === tabId ? 'active' : ''}`}
            onClick={() => setTab(tabId)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="pd-content">
        {tab === 'tasks' && (
          <div className="pd-tasks-panel">
            <p className="pd-hint">Tasks are optional — add them only when this project needs a breakdown for you or your team.</p>
            <div className="pd-task-add">
              <input
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="New task..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <AssigneeSelect team={team} value={taskAssignee} onChange={setTaskAssignee} />
              <button className="btn btn-primary btn-sm" onClick={handleAddTask}>
                <Plus size={14} /> Add Task
              </button>
            </div>
            {taskCount === 0 ? (
              <div className="pd-empty">
                <CheckSquare size={36} strokeWidth={1} />
                <p>No tasks yet. This project is just name + deadline until you add work items.</p>
              </div>
            ) : (
              <div className="pd-task-list">
                {(project.tasks || []).map((task) => (
                  <TaskItem key={task.id} task={task} team={team} projectId={id} onUpdate={setProject} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'tables' && (
          <div className="pd-tables-panel">
            <p className="pd-hint">
              All project tables on one board — expand or collapse each, add columns and rows inline.
            </p>
            <div className="pd-table-presets">
              {TABLE_TEMPLATES.map((tpl) => (
                <button key={tpl.name} className="filter-btn" onClick={() => handleAddTable(tpl)}>
                  + {tpl.name}
                </button>
              ))}
            </div>
            <div className="pd-table-add">
              <input
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                placeholder="Blank table name..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddTable()}
              />
              <button className="btn btn-primary btn-sm" onClick={() => handleAddTable()}>
                <Plus size={14} /> Blank Table
              </button>
            </div>

            {(project.dataTables || []).length === 0 ? (
              <div className="pd-empty">
                <Database size={36} strokeWidth={1} />
                <p>No tables yet. Use a template or create a blank table, then add columns and rows.</p>
              </div>
            ) : (
              <TableBoard
                tables={project.dataTables || []}
                getTableApi={getProjectTableApi}
                onDeleteTable={async (tableId) => {
                  if (!window.confirm('Delete this table and all its data?')) return;
                  const updated = await deleteProjectTable(id, tableId);
                  setProject(updated);
                  toast.success('Table deleted');
                }}
                onTableChange={refreshProject}
                highlightId={highlightTableId}
                emptyMessage="No tables yet."
              />
            )}
          </div>
        )}

        {tab === 'team' && (
          <div className="pd-team-panel">
            {myPending && (
              <div className="pd-invite-banner">
                <p>You have been invited to this project.</p>
                <button className="btn btn-primary btn-sm" onClick={handleAcceptMyInvite}>Accept invitation</button>
              </div>
            )}
            {isOwner && (
              <>
                <p className="pd-hint">Invite verified My Notion members by Gmail. They must accept before you can assign tasks.</p>
                <div className="pd-team-add">
                  <Mail size={16} className="pd-input-icon" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@gmail.com"
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={handleInvite}>
                    <Plus size={14} /> Send Invite
                  </button>
                </div>
              </>
            )}
            {members.length === 0 ? (
              <div className="pd-empty">
                <User size={36} strokeWidth={1} />
                <p>No team members yet. Invite collaborators by email.</p>
              </div>
            ) : (
              <div className="pd-members-table-wrap">
                <table className="pd-members-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Invited</th>
                      {isOwner && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m._id}>
                        <td>
                          <span className="pd-team-avatar-inline">{(m.name || m.email).charAt(0).toUpperCase()}</span>
                          {m.name || '—'}
                        </td>
                        <td>{m.email}</td>
                        <td><span className={`pd-member-status ${memberStatusClass(m.status)}`}>{memberStatusLabel(m.status)}</span></td>
                        <td>{m.createdAt ? format(new Date(m.createdAt), 'MMM d, yyyy') : '—'}</td>
                        {isOwner && (
                          <td>
                            <button
                              className="pd-icon-btn danger"
                              onClick={async () => {
                                const updated = await removeProjectMember(id, m._id);
                                setProject(updated);
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && <ProjectChat projectId={id} />}
      </div>
    </div>
  );
}
