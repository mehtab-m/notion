import { useEffect, useState } from 'react';

/**
 * Returns `value` only after it has stopped changing for `delay` ms.
 * Keeps a search box from firing a request on every keystroke.
 */
export default function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
