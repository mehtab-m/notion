import React, { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, FileUp } from 'lucide-react';
import { getApiBase } from '../../utils/api';
import './BookCard.css';

const BACKEND = getApiBase();

function pdfUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Full-screen in-app reader. The PDF is fetched as a blob and shown from a
 * blob: URL so the backend's frame headers can't block it and the browser's
 * built-in PDF viewer renders it right inside SortLife.
 */
export default function BookReader({ book, onClose, onEdit }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const url = pdfUrl(book.pdfFile);
    if (!url) return undefined;
    let objectUrl;
    let cancelled = false;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setSrc(objectUrl);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.pdfFile]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="book-reader" role="dialog" aria-modal="true" aria-label={`Reading ${book.title}`}>
      <div className="book-reader-bar">
        <button className="btn btn-secondary btn-sm" onClick={onClose}>
          <ArrowLeft size={14} /> Bookshelf
        </button>
        <h2>
          {book.title}
          {book.author && <small>{book.author}</small>}
        </h2>
        <button className="btn btn-secondary btn-sm" onClick={() => onEdit(book)}>
          <Pencil size={13} /> Edit
        </button>
      </div>

      {!book.pdfFile ? (
        <div className="book-reader-empty">
          <FileUp size={42} strokeWidth={1.2} />
          <h3>No PDF attached yet</h3>
          <p>Add the book's PDF and it opens right here whenever you tap the cover.</p>
          <button className="btn btn-primary" onClick={() => onEdit(book)}>
            <FileUp size={14} /> Attach PDF
          </button>
        </div>
      ) : error ? (
        <div className="book-reader-empty">
          <h3>Couldn't load this PDF</h3>
          <p>The file may have been removed. Attach it again from Edit.</p>
        </div>
      ) : !src ? (
        <div className="spinner-container" style={{ flex: 1 }}><div className="spinner" /></div>
      ) : (
        <iframe className="book-reader-frame" src={src} title={book.title} />
      )}
    </div>
  );
}
