import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import useApi from '../hooks/useApi';
import { getBooks, deleteBook, incrementBookPage, addLearningLine } from '../utils/api';
import BookCard from '../components/Books/BookCard';
import BookModal from '../components/Books/BookModal';

const STATUS_FILTERS = ['all', 'reading', 'want-to-read', 'completed', 'paused'];

export default function BooksPage() {
  const { data: books, loading, refetch } = useApi(getBooks);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editBook, setEditBook] = useState(null);

  const handleDelete = async (id) => {
    try {
      await deleteBook(id);
      toast.success('Book deleted');
      refetch();
    } catch {
      toast.error('Failed to delete book');
    }
  };

  const handleIncrementPage = async (id) => {
    try {
      await incrementBookPage(id, 1);
      toast.success('Page updated!');
      refetch();
    } catch {
      toast.error('Failed to update page');
    }
  };

  const handleLearningLine = async (bookId, text) => {
    try {
      await addLearningLine(bookId, text);
      toast.success('Learning line saved to notebook!');
    } catch {
      toast.error('Failed to save learning line');
      throw new Error('failed');
    }
  };

  const handleEdit = (book) => {
    setEditBook(book);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditBook(null);
    setModalOpen(true);
  };

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setEditBook(null);
  }, []);

  const filtered = (books || []).filter(
    (b) => statusFilter === 'all' || b.status === statusFilter
  );

  return (
    <div>
      <div className="page-header">
        <h1>Books</h1>
        <button className="btn btn-primary" onClick={handleNew}>
          <Plus size={16} /> Add Book
        </button>
      </div>

      <div className="filter-bar">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'want-to-read' ? 'Want to Read' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <h3>No books found</h3>
          <p>{statusFilter === 'all' ? 'Start tracking your reading.' : `No books with status "${statusFilter}".`}</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((book) => (
            <BookCard
              key={book._id}
              book={book}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onIncrementPage={handleIncrementPage}
              onLearningLine={handleLearningLine}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <BookModal book={editBook} onClose={handleClose} onSaved={refetch} />
      )}
    </div>
  );
}
