import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Projects
export const getProjects = () => api.get('/projects').then((r) => r.data);
export const createProject = (data) => api.post('/projects', data).then((r) => r.data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data).then((r) => r.data);
export const deleteProject = (id) => api.delete(`/projects/${id}`).then((r) => r.data);

// Books
export const getBooks = () => api.get('/books').then((r) => r.data);
export const createBook = (formData) =>
  api.post('/books', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateBook = (id, formData) =>
  api.put(`/books/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteBook = (id) => api.delete(`/books/${id}`).then((r) => r.data);

// Shows
export const getShows = () => api.get('/shows').then((r) => r.data);
export const createShow = (formData) =>
  api.post('/shows', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const updateShow = (id, formData) =>
  api.put(`/shows/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
export const deleteShow = (id) => api.delete(`/shows/${id}`).then((r) => r.data);

// Tables
export const getTables = () => api.get('/tables').then((r) => r.data);
export const createTable = (data) => api.post('/tables', data).then((r) => r.data);
export const getTable = (id) => api.get(`/tables/${id}`).then((r) => r.data);
export const updateTable = (id, data) => api.put(`/tables/${id}`, data).then((r) => r.data);
export const deleteTable = (id) => api.delete(`/tables/${id}`).then((r) => r.data);

// Rows
export const addRow = (tableId, data) => api.post(`/tables/${tableId}/rows`, { data }).then((r) => r.data);
export const updateRow = (tableId, rowId, data) =>
  api.put(`/tables/${tableId}/rows/${rowId}`, { data }).then((r) => r.data);
export const deleteRow = (tableId, rowId) =>
  api.delete(`/tables/${tableId}/rows/${rowId}`).then((r) => r.data);

// Columns
export const addColumn = (tableId, col) => api.post(`/tables/${tableId}/columns`, col).then((r) => r.data);
export const updateColumn = (tableId, colId, data) =>
  api.put(`/tables/${tableId}/columns/${colId}`, data).then((r) => r.data);
export const deleteColumn = (tableId, colId) =>
  api.delete(`/tables/${tableId}/columns/${colId}`).then((r) => r.data);
