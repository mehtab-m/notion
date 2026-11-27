import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Plus, Trash2, MessageCircle,
  Users, CheckSquare, Database, User, MessageSquare, Mail,
  LayoutDashboard, Columns, Timer, GitBranch, Server, Cloud, FileText, Terminal, Activity,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  getProject, updateProject, deleteProject,
  inviteProjectMember, removeProjectMember, acceptProjectInvite,
  addProjectTask, toggleProjectTask, deleteProjectTask, updateProjectTask,
  addProjectTable, deleteProjectTable,
  addProjectTableRow, updateProjectTableRow, deleteProjectTableRow,
  addProjectTableColumn, updateProjectTableColumn, deleteProjectTableColumn,
  getProjectMessages, sendProjectMessage, getProjectWorkspace,
} from '../utils/api';
import TableBoard from '../components/Tables/TableBoard';
import ConfirmDialog from '../components/ConfirmDialog';
import ResourcePanel from '../components/Projects/Workspace/ResourcePanel';
import DocsPanel from '../components/Projects/Workspace/DocsPanel';
import SessionPanel from '../components/Projects/Workspace/SessionPanel';
import { TaskBoard, TaskDetails, StatusPill, PriorityFlag, DueChip } from '../components/Projects/Workspace/Tasks';
import { OverviewPanel, ActivityPanel } from '../components/Projects/Workspace/Overview';
import { TASK_PRIORITIES, taskStatusOf } from '../components/Projects/Workspace/config';
import '../components/Projects/Workspace/Workspace.css';
import './ProjectDetailPage.css';

const EMPTY_WORKSPACE = {
  repositories: [], technologies: [], environments: [], services: [],
  documents: [], commands: [], sessions: [], activity: [],
};

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
  const { user } = useAuth();
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
    <div className="pd-task-discussion">
      <div className="pd-discussion-header">
        <MessageCircle size={14} />
        <span>Task discussion</span>
      </div>
      <div className="pd-discussion-messages">
        {messages.length === 0 ? (
          <p className="pd-discussion-empty">No messages yet — start the conversation</p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === user?._id;
            return (
              <div key={m._id} className={`pd-discussion-row ${mine ? 'mine' : 'theirs'}`}>
                {!mine && <span className="pd-chat-avatar">{(m.userName || '?').charAt(0).toUpperCase()}</span>}
                <div className="pd-discussion-bubble">
                  {!mine && (
                    <div className="pd-discussion-bubble-top">
                      <span className="pd-discussion-author">{m.userName}</span>
                    </div>
                  )}
                  <p>{m.text}</p>
                  <time>{format(new Date(m.createdAt), 'h:mm a')}</time>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="pd-discussion-compose">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button type="button" className="btn btn-primary btn-sm" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

function ProjectChat({ projectId }) {
  const { user } = useAuth();
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
      <div className="pd-panel-title">
        <MessageSquare size={16} />
        <h3>Team chat</h3>
      </div>
      <div className="pd-chat-messages">
        {messages.length === 0 ? (
          <div className="pd-empty"><MessageSquare size={36} strokeWidth={1} /><p>Start the project conversation</p></div>
        ) : (
          messages.map((m) => {
            const mine = m.userId === user?._id;
            return (
              <div key={m._id} className={`pd-chat-row ${mine ? 'mine' : 'theirs'}`}>
                {!mine && <span className="pd-chat-avatar">{(m.userName || '?').charAt(0).toUpperCase()}</span>}
                <div className="pd-chat-bubble">
                  {!mine && (
                    <div className="pd-chat-bubble-head">
                      <span className="pd-chat-author">{m.userName}</span>
                    </div>
                  )}
                  <p>{m.text}</p>
                  <time>{format(new Date(m.createdAt), 'h:mm a')}</time>
                </div>
              </div>
            );
          })
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

function TaskItem({ task, team, projectId, onUpdate, workspace, expanded, onToggleExpand, onStartSession }) {
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = taskStatusOf(task);

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
    try {
      const updated = await deleteProjectTask(projectId, task.id);
      onUpdate(updated);
    } catch { toast.error('Failed'); }
  };

  return (
    <div className={`pd-task-card ${task.done ? 'done' : ''}`} id={`task-${task.id}`}>
      <div className="pd-task-row">
        <label className="pd-task-check">
          <input type="checkbox" checked={!!task.done} onChange={handleToggle} />
        </label>
        <button type="button" className="ws-expand ws-task-title" onClick={onToggleExpand}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="pd-task-text">{task.text}</span>
        </button>
        <div className="ws-chips">
          {status !== 'done' && status !== 'ready' && <StatusPill status={status} />}
          <PriorityFlag priority={task.priority} />
          <DueChip dueAt={task.dueAt} done={task.done} />
          {(task.labels || []).map((l) => <span key={l} className="ws-chip">{l}</span>)}
        </div>
        <div className="pd-task-actions">
          <AssigneeSelect team={team} value={task.assignee} onChange={handleAssignee} />
          <button
            type="button"
            className={`pd-discuss-btn ${showDiscussion ? 'active' : ''}`}
            onClick={() => setShowDiscussion((v) => !v)}
            title="Task discussion"
          >
            <MessageCircle size={14} />
            <span className="pd-discuss-label">Chat</span>
          </button>
          <button type="button" className="pd-icon-btn danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {!expanded && task.nextAction && status !== 'done' && (
        <p className="ws-task-next">→ {task.nextAction}</p>
      )}
      {expanded && (
        <TaskDetails task={task} projectId={projectId} workspace={workspace} onUpdate={onUpdate}
          onStartSession={onStartSession} docs={workspace?.documents || []} />
      )}
      {showDiscussion && (
        <TaskComments projectId={projectId} taskId={task.id} />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete task?"
        message="This task will be permanently removed from the project."
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          setConfirmDelete(false);
          handleDelete();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(
    searchParams.get('invite') === 'pending' ? 'team' : (searchParams.get('tab') || 'overview'),
  );
  const [taskInput, setTaskInput] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskFilter, setTaskFilter] = useState('open');
  const [expandedTask, setExpandedTask] = useState(null);
  const [sessionTask, setSessionTask] = useState('');
  const [workspace, setWorkspace] = useState(EMPTY_WORKSPACE);
  const [inviteEmail, setInviteEmail] = useState('');
  const [tableInput, setTableInput] = useState('');
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [deleteTableId, setDeleteTableId] = useState(null);
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

  const fetchWorkspace = useCallback(async () => {
    try {
      setWorkspace({ ...EMPTY_WORKSPACE, ...(await getProjectWorkspace(id)) });
    } catch (err) {
      if (err.response?.status >= 500) toast.error(err.response?.data?.error || 'Could not load the project workspace');
    }
  }, [id]);

  useEffect(() => { fetchWorkspace(); }, [fetchWorkspace]);
  // Activity is written server-side on every change — refresh it when it is on screen.
  useEffect(() => { if (tab === 'overview' || tab === 'activity') fetchWorkspace(); }, [tab, fetchWorkspace]);

  const onWorkspaceChange = useCallback((kind, items) => {
    setWorkspace((prev) => ({ ...prev, [kind]: items }));
  }, []);

  const goTab = (next) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openTask = (taskId) => {
    setTaskFilter('all');
    setExpandedTask(taskId);
    setTab('tasks');
    setTimeout(() => document.getElementById(`task-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
  };

  const startSessionFor = (taskId) => {
    setSessionTask(taskId);
    goTab('sessions');
  };

  const team = project?.team || [];
  const members = project?.members || [];
  const isOwner = project?.isOwner !== false;
  const myPending = members.find((m) => m.email === user?.email && m.status === 'pending');

  const saveField = async (patch) => {
    try {
      const updated = await updateProject(id, patch);
      setProject(updated);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleAddTask = async () => {
    if (!taskInput.trim()) return;
    try {
      const updated = await addProjectTask(id, { text: taskInput.trim(), assignee: taskAssignee, priority: taskPriority });
      setProject(updated);
      setTaskInput('');
      setTaskAssignee('');
      setTaskPriority('medium');
      toast.success('Task added');
    } catch { toast.error('Failed'); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      const updated = await inviteProjectMember(id, inviteEmail.trim());
      setProject(updated);
      setInviteEmail('');
      if (updated.emailDelivered === false) {
        toast.error("Invite created, but the email couldn't be sent — share the project link manually", { duration: 6000 });
      } else {
        toast.success('Invitation sent');
      }
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
  const allTasks = (project.tasks || []).filter((t) => !t.archivedAt);
  const openCount = allTasks.filter((t) => taskStatusOf(t) !== 'done').length;
  const filteredTasks = allTasks.filter((t) => {
    const s = taskStatusOf(t);
    if (taskFilter === 'open') return s !== 'done';
    if (taskFilter === 'done') return s === 'done';
    if (taskFilter === 'all') return true;
    return s === taskFilter;
  });
  const canEdit = isOwner || members.some((m) => m.email === user?.email && m.status === 'accepted');
  const activeSession = (workspace.sessions || []).some((s) => s.status === 'active');

  const tabs = [
    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
    { id: 'tasks', icon: CheckSquare, label: 'Tasks', count: openCount },
    { id: 'board', icon: Columns, label: 'Board' },
    { id: 'sessions', icon: Timer, label: activeSession ? 'Session •' : 'Sessions' },
    { id: 'repos', icon: GitBranch, label: 'Repos', count: workspace.repositories.length },
    { id: 'envs', icon: Server, label: 'Envs', count: workspace.environments.length },
    { id: 'services', icon: Cloud, label: 'Services', count: workspace.services.length },
    { id: 'docs', icon: FileText, label: 'Docs', count: workspace.documents.filter((d) => !d.archivedAt).length },
    { id: 'commands', icon: Terminal, label: 'Commands', count: workspace.commands.length },
    { id: 'tables', icon: Database, label: 'Tables', count: (project.dataTables || []).length },
    { id: 'team', icon: Users, label: 'Team', count: members.length },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'activity', icon: Activity, label: 'Activity' },
  ];

  return (
    <div className="project-detail">
      <button className="pd-back" onClick={() => navigate('/projects')}>
        <ArrowLeft size={16} /> Back to Projects
      </button>

      <header className="pd-hero">
        <div className="pd-hero-top">
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
          {isOwner && (
            <button
              type="button"
              className="btn btn-danger btn-sm pd-delete-btn"
              onClick={() => setConfirmDeleteProject(true)}
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>

        <div className="pd-hero-chips">
          <label className="pd-chip pd-chip-deadline">
            <Calendar size={14} />
            <input
              type="date"
              value={project.dueDate ? project.dueDate.slice(0, 10) : ''}
              onChange={(e) => saveField({ dueDate: e.target.value || undefined })}
            />
            {dueDate && (
              <span className={overdue ? 'overdue' : ''}>
                {format(dueDate, 'MMM d, yyyy')}
                {overdue && ' · Overdue'}
              </span>
            )}
          </label>
          <select
            className="pd-chip pd-chip-status"
            value={project.status}
            onChange={(e) => saveField({ status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="planned">Planned</option>
            <option value="on-hold">On Hold</option>
            <option value="maintenance">Maintenance</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          {taskCount > 0 && (
            <span className="pd-chip pd-chip-progress">{project.progress}% complete</span>
          )}
        </div>
      </header>

      <nav className="pd-nav" aria-label="Project sections">
        {tabs.map(({ id: tabId, icon: Icon, label, count }) => (
          <button
            key={tabId}
            type="button"
            className={`pd-nav-item ${tab === tabId ? 'active' : ''}`}
            onClick={() => setTab(tabId)}
          >
            <Icon size={16} />
            <span>{label}</span>
            {count != null && <span className="pd-nav-count">{count}</span>}
          </button>
        ))}
      </nav>

      <main className="pd-content">
        {tab === 'overview' && (
          <OverviewPanel
            project={project}
            projectId={id}
            workspace={workspace}
            canEdit={canEdit}
            saveField={saveField}
            onChanged={onWorkspaceChange}
            goTab={goTab}
            openTask={openTask}
          />
        )}

        {tab === 'tasks' && (
          <section className="pd-section">
            <div className="pd-panel-title">
              <CheckSquare size={16} />
              <h3>Tasks</h3>
            </div>
            <div className="pd-add-bar">
              <input
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Add a new task..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <select className="assignee-select" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} aria-label="Priority">
                {TASK_PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              <AssigneeSelect team={team} value={taskAssignee} onChange={setTaskAssignee} />
              <button type="button" className="btn btn-primary btn-sm" onClick={handleAddTask}>
                <Plus size={14} /> Add
              </button>
            </div>
            {taskCount > 0 && (
              <div className="pd-table-presets">
                {[
                  ['open', 'Open'], ['in_progress', 'In progress'], ['blocked', 'Blocked'],
                  ['review', 'Review'], ['inbox', 'Inbox'], ['done', 'Done'], ['all', 'All'],
                ].map(([fid, label]) => (
                  <button key={fid} type="button" className={`filter-btn ${taskFilter === fid ? 'active' : ''}`} onClick={() => setTaskFilter(fid)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {taskCount === 0 ? (
              <div className="pd-empty">
                <CheckSquare size={36} strokeWidth={1} />
                <p>No tasks yet</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="pd-empty"><p>No tasks in this view</p></div>
            ) : (
              <div className="pd-task-list">
                {filteredTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    team={team}
                    projectId={id}
                    onUpdate={setProject}
                    workspace={workspace}
                    expanded={expandedTask === task.id}
                    onToggleExpand={() => setExpandedTask((cur) => (cur === task.id ? null : task.id))}
                    onStartSession={startSessionFor}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'board' && (
          <section className="pd-section">
            <div className="pd-panel-title">
              <Columns size={16} />
              <h3>Board</h3>
            </div>
            <TaskBoard tasks={project.tasks || []} projectId={id} team={team} onUpdate={setProject} onOpenTask={openTask} />
          </section>
        )}

        {tab === 'sessions' && (
          <SessionPanel
            projectId={id}
            project={project}
            workspace={workspace}
            preselectTaskId={sessionTask}
            onChanged={onWorkspaceChange}
            onProjectRefresh={refreshProject}
          />
        )}

        {tab === 'repos' && (
          <ResourcePanel projectId={id} kind="repositories" workspace={workspace} canEdit={canEdit} onChanged={onWorkspaceChange} icon={GitBranch} />
        )}
        {tab === 'envs' && (
          <ResourcePanel projectId={id} kind="environments" workspace={workspace} canEdit={canEdit} onChanged={onWorkspaceChange} icon={Server} />
        )}
        {tab === 'services' && (
          <ResourcePanel projectId={id} kind="services" workspace={workspace} canEdit={canEdit} onChanged={onWorkspaceChange} icon={Cloud} />
        )}
        {tab === 'commands' && (
          <ResourcePanel projectId={id} kind="commands" workspace={workspace} canEdit={canEdit} onChanged={onWorkspaceChange} icon={Terminal} />
        )}
        {tab === 'docs' && (
          <DocsPanel projectId={id} workspace={workspace} tasks={allTasks} canEdit={canEdit} onChanged={onWorkspaceChange} />
        )}
        {tab === 'activity' && <ActivityPanel workspace={workspace} />}

        {tab === 'tables' && (
          <section className="pd-section">
            <div className="pd-panel-title">
              <Database size={16} />
              <h3>Data tables</h3>
            </div>
            <div className="pd-table-presets">
              {TABLE_TEMPLATES.map((tpl) => (
                <button key={tpl.name} type="button" className="filter-btn" onClick={() => handleAddTable(tpl)}>
                  + {tpl.name}
                </button>
              ))}
            </div>
            <div className="pd-add-bar">
              <input
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                placeholder="Blank table name..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddTable()}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddTable()}>
                <Plus size={14} /> Create
              </button>
            </div>
            {(project.dataTables || []).length === 0 ? (
              <div className="pd-empty">
                <Database size={36} strokeWidth={1} />
                <p>No tables yet</p>
              </div>
            ) : (
              <TableBoard
                tables={project.dataTables || []}
                getTableApi={getProjectTableApi}
                onDeleteTable={setDeleteTableId}
                onTableChange={refreshProject}
                highlightId={highlightTableId}
                emptyMessage="No tables yet."
              />
            )}
          </section>
        )}

        {tab === 'team' && (
          <section className="pd-section">
            <div className="pd-panel-title">
              <Users size={16} />
              <h3>Team members</h3>
            </div>
            {myPending && (
              <div className="pd-invite-banner">
                <p>You have been invited to this project.</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleAcceptMyInvite}>Accept</button>
              </div>
            )}
            {isOwner && (
              <div className="pd-add-bar pd-add-bar-email">
                <Mail size={16} className="pd-input-icon" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Invite by Gmail..."
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={handleInvite}>
                  <Plus size={14} /> Invite
                </button>
              </div>
            )}
            {members.length === 0 ? (
              <div className="pd-empty">
                <User size={36} strokeWidth={1} />
                <p>No team members yet</p>
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
                        <td data-label="Name">
                          <span className="pd-team-avatar-inline">{(m.name || m.email).charAt(0).toUpperCase()}</span>
                          {m.name || '—'}
                        </td>
                        <td data-label="Email">{m.email}</td>
                        <td data-label="Status">
                          <span className={`pd-member-status ${memberStatusClass(m.status)}`}>
                            {memberStatusLabel(m.status)}
                          </span>
                        </td>
                        <td data-label="Invited">{m.createdAt ? format(new Date(m.createdAt), 'MMM d, yyyy') : '—'}</td>
                        {isOwner && (
                          <td data-label="">
                            <button
                              type="button"
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
          </section>
        )}

        {tab === 'chat' && (
          <section className="pd-section">
            <ProjectChat projectId={id} />
          </section>
        )}
      </main>

      <ConfirmDialog
        open={confirmDeleteProject}
        title="Delete project?"
        message="This project and all its tasks, tables, and data will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          setConfirmDeleteProject(false);
          await deleteProject(id);
          toast.success('Deleted');
          navigate('/projects');
        }}
        onCancel={() => setConfirmDeleteProject(false)}
      />

      <ConfirmDialog
        open={!!deleteTableId}
        title="Delete table?"
        message="This table and all its data will be permanently removed."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const tableId = deleteTableId;
          setDeleteTableId(null);
          const updated = await deleteProjectTable(id, tableId);
          setProject(updated);
          toast.success('Table deleted');
        }}
        onCancel={() => setDeleteTableId(null)}
      />
    </div>
  );
}
