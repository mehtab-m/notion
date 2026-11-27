import axios from 'axios';

const TOKEN_KEY = 'auth_token';

function resolveApiBase() {
  const raw = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

const api = axios.create({
  baseURL: resolveApiBase(),
  timeout: 90000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/')) {
      localStorage.removeItem(TOKEN_KEY);
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────
export const signup = (data) => api.post('/auth/signup', data).then((r) => r.data);
export const verifyEmail = (data) => api.post('/auth/verify', data).then((r) => r.data);
export const resendCode = (email) => api.post('/auth/resend', { email }).then((r) => r.data);
export const login = (data) => api.post('/auth/login', data).then((r) => r.data);
export const getMe = () => api.get('/auth/me').then((r) => r.data);
export const updatePreferences = (data) => api.patch('/auth/preferences', data).then((r) => r.data);
export const pingActivity = () => api.post('/auth/ping').then((r) => r.data);
export const updateProfile = (data) => api.patch('/auth/profile', data).then((r) => r.data);
export const updatePassword = (data) => api.patch('/auth/password', data).then((r) => r.data);

// ── Admin ────────────────────────────────────────────────
export const getAdminStats = () => api.get('/admin/stats').then((r) => r.data);
export const getAdminUsers = () => api.get('/admin/users').then((r) => r.data);
export const updateAdminUser = (id, data) => api.patch(`/admin/users/${id}`, data).then((r) => r.data);

// ── Projects ────────────────────────────────────────────
export const getProjects = () => api.get('/projects').then((r) => r.data);
export const getProject = (id) => api.get(`/projects/${id}`).then((r) => r.data);
export const createProject = (data) => api.post('/projects', data).then((r) => r.data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id) => api.delete(`/projects/${id}`).then((r) => r.data);
export const addTeamMember = (projectId, name) =>
  api.post(`/projects/${projectId}/team`, { name }).then((r) => r.data);
export const removeTeamMember = (projectId, name) =>
  api.delete(`/projects/${projectId}/team/${encodeURIComponent(name)}`).then((r) => r.data);
export const getPendingInvitations = () => api.get('/projects/invitations/pending').then((r) => r.data);
export const acceptProjectInvite = (memberId) =>
  api.post(`/projects/invitations/${memberId}/accept`).then((r) => r.data);
export const declineProjectInvite = (memberId) =>
  api.post(`/projects/invitations/${memberId}/decline`).then((r) => r.data);
export const inviteProjectMember = (projectId, email) =>
  api.post(`/projects/${projectId}/invite`, { email }).then((r) => r.data);
export const removeProjectMember = (projectId, memberId) =>
  api.delete(`/projects/${projectId}/members/${memberId}`).then((r) => r.data);
export const getProjectMessages = (projectId, taskId) =>
  api.get(`/projects/${projectId}/messages`, { params: taskId ? { taskId } : {} }).then((r) => r.data);
export const sendProjectMessage = (projectId, data) =>
  api.post(`/projects/${projectId}/messages`, data).then((r) => r.data);
export const addProjectTask = (projectId, data) =>
  api.post(`/projects/${projectId}/tasks`, data).then((r) => r.data);
export const updateProjectTask = (projectId, taskId, data) =>
  api.put(`/projects/${projectId}/tasks/${taskId}`, data).then((r) => r.data);
export const toggleProjectTask = (projectId, taskId) =>
  api.post(`/projects/${projectId}/tasks/${taskId}/toggle`).then((r) => r.data);
export const deleteProjectTask = (projectId, taskId) =>
  api.delete(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data);
export const addProjectSubtask = (projectId, taskId, data) =>
  api.post(`/projects/${projectId}/tasks/${taskId}/subtasks`, data).then((r) => r.data);
export const updateProjectSubtask = (projectId, taskId, subId, data) =>
  api.put(`/projects/${projectId}/tasks/${taskId}/subtasks/${subId}`, data).then((r) => r.data);
export const toggleProjectSubtask = (projectId, taskId, subId) =>
  api.post(`/projects/${projectId}/tasks/${taskId}/subtasks/${subId}/toggle`).then((r) => r.data);
export const deleteProjectSubtask = (projectId, taskId, subId) =>
  api.delete(`/projects/${projectId}/tasks/${taskId}/subtasks/${subId}`).then((r) => r.data);
export const addProjectTable = (projectId, data) =>
  api.post(`/projects/${projectId}/tables`, data).then((r) => r.data);
export const deleteProjectTable = (projectId, tableId) =>
  api.delete(`/projects/${projectId}/tables/${tableId}`).then((r) => r.data);
export const addProjectTableRow = (projectId, tableId, data) =>
  api.post(`/projects/${projectId}/tables/${tableId}/rows`, data).then((r) => r.data);
export const updateProjectTableRow = (projectId, tableId, rowId, data) =>
  api.put(`/projects/${projectId}/tables/${tableId}/rows/${rowId}`, data).then((r) => r.data);
export const deleteProjectTableRow = (projectId, tableId, rowId) =>
  api.delete(`/projects/${projectId}/tables/${tableId}/rows/${rowId}`).then((r) => r.data);
export const addProjectTableColumn = (projectId, tableId, col) =>
  api.post(`/projects/${projectId}/tables/${tableId}/columns`, col).then((r) => r.data);
export const updateProjectTableColumn = (projectId, tableId, colId, data) =>
  api.put(`/projects/${projectId}/tables/${tableId}/columns/${colId}`, data).then((r) => r.data);
export const deleteProjectTableColumn = (projectId, tableId, colId) =>
  api.delete(`/projects/${projectId}/tables/${tableId}/columns/${colId}`).then((r) => r.data);
export const moveProjectTask = (projectId, taskId, data) =>
  api.post(`/projects/${projectId}/tasks/${taskId}/move`, data).then((r) => r.data);

// ── Project workspace (repos, stack, environments, services, docs, commands, sessions) ──
export const getMyWork = () => api.get('/projects/workspace/my-work').then((r) => r.data);
export const getProjectWorkspace = (projectId) => api.get(`/projects/${projectId}/workspace`).then((r) => r.data);
export const getProjectActivity = (projectId) => api.get(`/projects/${projectId}/activity`).then((r) => r.data);
/** kind: repositories | technologies | environments | services | documents | commands */
export const createProjectItem = (projectId, kind, data) =>
  api.post(`/projects/${projectId}/${kind}`, data).then((r) => r.data);
export const updateProjectItem = (projectId, kind, itemId, data) =>
  api.put(`/projects/${projectId}/${kind}/${itemId}`, data).then((r) => r.data);
export const deleteProjectItem = (projectId, kind, itemId) =>
  api.delete(`/projects/${projectId}/${kind}/${itemId}`).then((r) => r.data);
export const getActiveWorkSession = () => api.get('/projects/sessions/active').then((r) => r.data);
export const startWorkSession = (projectId, data) =>
  api.post(`/projects/${projectId}/sessions`, data).then((r) => r.data);
export const updateWorkSession = (projectId, sid, data) =>
  api.put(`/projects/${projectId}/sessions/${sid}`, data).then((r) => r.data);
export const pauseWorkSession = (projectId, sid) =>
  api.post(`/projects/${projectId}/sessions/${sid}/pause`).then((r) => r.data);
export const resumeWorkSession = (projectId, sid) =>
  api.post(`/projects/${projectId}/sessions/${sid}/resume`).then((r) => r.data);
export const completeWorkSession = (projectId, sid, data) =>
  api.post(`/projects/${projectId}/sessions/${sid}/complete`, data).then((r) => r.data);
export const deleteWorkSession = (projectId, sid) =>
  api.delete(`/projects/${projectId}/sessions/${sid}`).then((r) => r.data);

// ── Books ────────────────────────────────────────────────
export const getBooks = () => api.get('/books').then((r) => r.data);
export const createBook = (formData) =>
  api.post('/books', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateBook = (id, formData) =>
  api.put(`/books/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteBook = (id) => api.delete(`/books/${id}`).then((r) => r.data);
export const incrementBookPage = (id, increment = 1) =>
  api.patch(`/books/${id}/increment-page`, { increment }).then((r) => r.data);
export const addLearningLine = (bookId, text) =>
  api.post(`/books/${bookId}/learning-line`, { text }).then((r) => r.data);

// ── Shows ────────────────────────────────────────────────
export const getShows = () => api.get('/shows').then((r) => r.data);
export const createShow = (formData) =>
  api.post('/shows', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateShow = (id, formData) =>
  api.put(`/shows/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteShow = (id) => api.delete(`/shows/${id}`).then((r) => r.data);

// ── Tables ───────────────────────────────────────────────
export const getTables = () => api.get('/tables').then((r) => r.data);
export const createTable = (data) => api.post('/tables', data).then((r) => r.data);
export const getTable = (id) => api.get(`/tables/${id}`).then((r) => r.data);
export const updateTable = (id, data) => api.put(`/tables/${id}`, data).then((r) => r.data);
export const deleteTable = (id) => api.delete(`/tables/${id}`).then((r) => r.data);
export const addRow = (tableId, data) => api.post(`/tables/${tableId}/rows`, { data }).then((r) => r.data);
export const updateRow = (tableId, rowId, data) =>
  api.put(`/tables/${tableId}/rows/${rowId}`, { data }).then((r) => r.data);
export const deleteRow = (tableId, rowId) =>
  api.delete(`/tables/${tableId}/rows/${rowId}`).then((r) => r.data);
export const addColumn = (tableId, col) => api.post(`/tables/${tableId}/columns`, col).then((r) => r.data);
export const updateColumn = (tableId, colId, data) =>
  api.put(`/tables/${tableId}/columns/${colId}`, data).then((r) => r.data);
export const deleteColumn = (tableId, colId) =>
  api.delete(`/tables/${tableId}/columns/${colId}`).then((r) => r.data);

// ── Notes ────────────────────────────────────────────────
export const getNotes = (params) => api.get('/notes', { params }).then((r) => r.data);
export const getNote = (id) => api.get(`/notes/${id}`).then((r) => r.data);
export const getNoteChildren = (id) => api.get(`/notes/${id}/children`).then((r) => r.data);
export const createNote = (data) => api.post('/notes', data).then((r) => r.data);
export const updateNote = (id, data) => api.put(`/notes/${id}`, data).then((r) => r.data);
export const deleteNote = (id) => api.delete(`/notes/${id}`).then((r) => r.data);
export const uploadNoteImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return api.post('/notes/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
};

// ── Sticky Notes ─────────────────────────────────────────
export const getStickyNotes = () => api.get('/stickynotes').then((r) => r.data);
export const createStickyNote = (data) => api.post('/stickynotes', data).then((r) => r.data);
export const updateStickyNote = (id, data) => api.put(`/stickynotes/${id}`, data).then((r) => r.data);
export const deleteStickyNote = (id) => api.delete(`/stickynotes/${id}`).then((r) => r.data);

// ── Habits ───────────────────────────────────────────────
export const getHabits = () => api.get('/habits').then((r) => r.data);
export const createHabit = (data) => api.post('/habits', data).then((r) => r.data);
export const updateHabit = (id, data) => api.put(`/habits/${id}`, data).then((r) => r.data);
export const deleteHabit = (id) => api.delete(`/habits/${id}`).then((r) => r.data);
export const toggleHabitDate = (id, date) =>
  api.post(`/habits/${id}/toggle`, { date }).then((r) => r.data);

// ── Goals ────────────────────────────────────────────────
export const getGoals = () => api.get('/goals').then((r) => r.data);
export const createGoal = (data) => api.post('/goals', data).then((r) => r.data);
export const updateGoal = (id, data) => api.put(`/goals/${id}`, data).then((r) => r.data);
export const patchGoal = (id, data) => api.patch(`/goals/${id}`, data).then((r) => r.data);
export const deleteGoal = (id) => api.delete(`/goals/${id}`).then((r) => r.data);
export const toggleMilestone = (goalId, msId) =>
  api.post(`/goals/${goalId}/milestones/${msId}/toggle`).then((r) => r.data);
export const toggleSubgoal = (goalId, msId, sgId) =>
  api.post(`/goals/${goalId}/milestones/${msId}/subgoals/${sgId}/toggle`).then((r) => r.data);

// ── Search ───────────────────────────────────────────────
export const searchAll = (q, { signal } = {}) =>
  api.get('/search', { params: { q }, signal }).then((r) => r.data);

// ── Dashboard ────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard/stats').then((r) => r.data);

// ── Money ────────────────────────────────────────────────
export const getMoneySummary = () => api.get('/money/summary').then((r) => r.data);
export const getMoneyFriends = () => api.get('/money/friends').then((r) => r.data);
export const createMoneyFriend = (data) => api.post('/money/friends', data).then((r) => r.data);
export const deleteMoneyFriend = (id) => api.delete(`/money/friends/${id}`).then((r) => r.data);
export const getMoneyTransactions = (friendId) =>
  api.get(`/money/friends/${friendId}/transactions`).then((r) => r.data);
export const addMoneyTransaction = (friendId, data) =>
  api.post(`/money/friends/${friendId}/transactions`, data).then((r) => r.data);
export const updateMoneyTransaction = (id, data) =>
  api.put(`/money/transactions/${id}`, data).then((r) => r.data);
export const deleteMoneyTransaction = (id) =>
  api.delete(`/money/transactions/${id}`).then((r) => r.data);

export const getApiBase = () => resolveApiBase().replace(/\/api$/, '') || 'http://localhost:5000';

/* ═══════════════════════════════════════════════════════════
   Appearance, account & the feature set added alongside the
   redesign. Grouped here rather than in per-feature modules so
   there stays exactly one place that knows the URL shapes.
   ═══════════════════════════════════════════════════════════ */

// ── Appearance ───────────────────────────────────────────
export const updateTheme = (data) => api.patch('/auth/theme', data).then((r) => r.data);

// ── Account ──────────────────────────────────────────────
// In-app alerts + weekly digest (backend/routes/notifications.js)
export const getNotifications = () =>
  api.get('/notifications', { params: { hour: new Date().getHours() } }).then((r) => r.data);
export const markNotificationsRead = (ids) => api.post('/notifications/read', { ids }).then((r) => r.data);
export const markAllNotificationsRead = () =>
  api.post('/notifications/read-all', { hour: new Date().getHours() }).then((r) => r.data);
export const sendTestDigest = () => api.post('/notifications/test-email').then((r) => r.data);
export const updateNotifications = (data) =>
  api.patch('/auth/notifications', data).then((r) => r.data);
export const uploadAvatar = (file) => {
  const fd = new FormData();
  fd.append('avatar', file);
  return api
    .post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};
export const setAvatarUrl = (avatarUrl) =>
  api.post('/auth/avatar', { avatarUrl }).then((r) => r.data);
export const removeAvatar = () => api.delete('/auth/avatar').then((r) => r.data);
export const deleteAccount = (data) =>
  api.delete('/auth/account', { data }).then((r) => r.data);

// ── Archive, trash & favourites ──────────────────────────
export const getArchive = () => api.get('/lifecycle/archive').then((r) => r.data);
export const getTrash = () => api.get('/lifecycle/trash').then((r) => r.data);
export const getFavorites = () => api.get('/lifecycle/favorites').then((r) => r.data);
export const archiveItem = (type, id) =>
  api.post(`/lifecycle/${type}/${id}/archive`).then((r) => r.data);
export const unarchiveItem = (type, id) =>
  api.post(`/lifecycle/${type}/${id}/unarchive`).then((r) => r.data);
export const restoreItem = (type, id) =>
  api.post(`/lifecycle/${type}/${id}/restore`).then((r) => r.data);
export const purgeItem = (type, id) =>
  api.delete(`/lifecycle/${type}/${id}`).then((r) => r.data);
export const toggleFavorite = (type, id, favorite) =>
  api.post(`/lifecycle/${type}/${id}/favorite`, favorite === undefined ? {} : { favorite })
    .then((r) => r.data);
export const emptyTrash = () => api.post('/lifecycle/trash/empty').then((r) => r.data);

// ── Quick-capture inbox ──────────────────────────────────
export const getInbox = (params) => api.get('/inbox', { params }).then((r) => r.data);
export const createInboxItem = (data) => api.post('/inbox', data).then((r) => r.data);
export const updateInboxItem = (id, data) => api.put(`/inbox/${id}`, data).then((r) => r.data);
export const toggleInboxItem = (id) => api.post(`/inbox/${id}/toggle`).then((r) => r.data);
export const convertInboxItem = (id, target) =>
  api.post(`/inbox/${id}/convert`, { target }).then((r) => r.data);
export const deleteInboxItem = (id) => api.delete(`/inbox/${id}`).then((r) => r.data);
export const clearDoneInbox = () => api.post('/inbox/clear-done').then((r) => r.data);

// ── Focus timer ──────────────────────────────────────────
export const getFocusSessions = (days) =>
  api.get('/focus', { params: days ? { days } : {} }).then((r) => r.data);
export const logFocusSession = (data) => api.post('/focus', data).then((r) => r.data);
export const deleteFocusSession = (id) => api.delete(`/focus/${id}`).then((r) => r.data);

// ── Insights ─────────────────────────────────────────────
export const getAnalytics = (days) =>
  api.get('/analytics/overview', { params: days ? { days } : {} }).then((r) => r.data);
export const getToday = () => api.get('/analytics/today').then((r) => r.data);
export const getWeeklySummary = () => api.get('/analytics/weekly').then((r) => r.data);

// ── Export & import ──────────────────────────────────────
export const getDataSummary = () => api.get('/data/summary').then((r) => r.data);
export const exportData = (only) =>
  api.get('/data/export', { params: only ? { only } : {} }).then((r) => r.data);
export const importData = (payload, mode = 'merge') =>
  api.post('/data/import', { ...payload, mode }).then((r) => r.data);

/** A plain <a href> could not carry the bearer token, and putting it in
    the query string would leak it into logs — so the CSV is fetched
    through the same authorised client and saved from a Blob. */
export const exportCsv = (collection) =>
  api
    .get('/data/export.csv', { params: { collection }, responseType: 'blob' })
    .then((r) => r.data);


export const createStripeSubscription = (data) =>
  api.post('/stripe/create-subscription', data).then((r) => r.data);