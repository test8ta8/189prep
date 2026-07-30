import { useEffect } from 'react';

export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `189Prep | ${title}` : '189Prep';
  }, [title]);
}
