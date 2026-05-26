import { useEffect } from 'react';

/**
 * Custom hook to set document title dynamically.
 * Automatically appends " | WaZuri" suffix.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | WaZuri`;

    return () => {
      document.title = previousTitle;
    };
  }, [title]);
}
