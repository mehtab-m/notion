import { useState, useEffect } from 'react';

export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    setMatches(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/* Must stay in step with the 900px drawer breakpoint in the stylesheet.
   It used to say 768px, so between 769 and 900 the JS believed it was on
   desktop (rail toggle live, desktop-only nav items shown) while the CSS
   had already turned the sidebar into a drawer. */
export const MOBILE_QUERY = '(max-width: 900px)';
