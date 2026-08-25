import React from 'react';
import './Skeleton.css';

/**
 * Content-shaped placeholders. A spinner tells the user "wait"; a
 * skeleton tells them what is about to appear and keeps the layout
 * from jumping when it does.
 */
export function Skeleton({ width, height = 14, radius, className = '', style }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <span className="skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? '60%' : width}
          height={12}
        />
      ))}
    </span>
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-card-head">
        <Skeleton width={38} height={38} radius="10px" />
        <div className="skeleton-card-head-text">
          <Skeleton width="65%" height={13} />
          <Skeleton width="40%" height={11} />
        </div>
      </div>
      <SkeletonText lines={2} />
      <Skeleton width="100%" height={6} radius="3px" />
    </div>
  );
}

/** Grid of card skeletons matching the `.card-grid` layout. */
export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="card-grid" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function SkeletonRows({ count = 6 }) {
  return (
    <div className="skeleton-rows" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-row">
          <Skeleton width={20} height={20} radius="6px" />
          <Skeleton width={`${45 + ((i * 13) % 35)}%`} height={13} />
          <Skeleton width={54} height={20} radius="20px" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Full-page fallback used while a lazily-loaded route chunk arrives. */
export function PageSkeleton() {
  return (
    <div className="skeleton-page" role="status" aria-label="Loading page">
      <div className="skeleton-page-header">
        <Skeleton width={180} height={24} radius="8px" />
        <Skeleton width={120} height={34} radius="8px" />
      </div>
      <SkeletonGrid count={6} />
    </div>
  );
}

export default Skeleton;
