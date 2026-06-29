import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// ── Projects ────────────────────────────────────────────
export const getProjects = () => api.get('/projects').then((r) => r.data);
export const createProject = (data) => api.post('/projects', data).then((r) => r.data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id) => api.delete(`/projects/${id}`).then((r) => r.data);

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
export const deleteGoal = (id) => api.delete(`/goals/${id}`).then((r) => r.data);
export const toggleMilestone = (goalId, msId) =>
  api.post(`/goals/${goalId}/milestones/${msId}/toggle`).then((r) => r.data);

// ── Dashboard ────────────────────────────────────────────
export const getDashboardStats = () => api.get('/dashboard/stats').then((r) => r.data);

export const getApiBase = () => import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
