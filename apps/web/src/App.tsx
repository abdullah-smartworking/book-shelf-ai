import { useState } from 'react';

import { BookDetailPage } from './pages/BookDetailPage';
import { CataloguePage } from './pages/CataloguePage';

/**
 * Two views, owned by one piece of state. A router is the conventional choice
 * once there's more than one page, but two views selected by one id is exactly
 * what useState is for — react-router-dom would buy a dependency and a <Routes>
 * tree to maintain, and nothing else. Revisit if a third page or deep-linkable
 * URLs are ever needed (see CLAUDE.md's "Don't add react-router-dom" note).
 */
export function App(): React.JSX.Element {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  return selectedBookId === null ? (
    <CataloguePage onSelectBook={setSelectedBookId} />
  ) : (
    <BookDetailPage bookId={selectedBookId} onBack={() => setSelectedBookId(null)} />
  );
}
