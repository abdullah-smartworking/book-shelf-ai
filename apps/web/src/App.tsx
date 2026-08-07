import { useState } from 'react';

import { BookDetailPage } from './pages/BookDetailPage';
import { CataloguePage } from './pages/CataloguePage';
import { ListDetailPage } from './pages/ListDetailPage';
import { ListsPage } from './pages/ListsPage';
import { ProfilePage } from './pages/ProfilePage';

type Tab = 'catalogue' | 'lists' | 'profile';

/**
 * Three tabs, still no router — `react-router-dom` would buy a dependency and a
 * <Routes> tree for what a handful of `useState` calls already do (see
 * CLAUDE.md's "Don't add react-router-dom" note). Profile has no drill-down id
 * of its own (it owns its own userId lookup internally), so it needs no entry
 * here beyond the tab switch itself.
 *
 * `selectedBookId` is shared across tabs: opening a book from a list's detail view
 * shows the same BookDetailPage the catalogue uses, and its `onBack` clears just that
 * id — landing back on whichever tab you came from, at the list you were looking at
 * (selectedListId is untouched), not the tab's root.
 */
export function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('catalogue');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  function switchTab(next: Tab): void {
    setTab(next);
    setSelectedBookId(null);
    setSelectedListId(null);
  }

  return (
    <>
      <nav className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6 lg:px-8">
          {(['catalogue', 'lists', 'profile'] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => switchTab(candidate)}
              className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                tab === candidate
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {candidate === 'catalogue' ? 'Catalogue' : candidate === 'lists' ? 'Reading Lists' : 'Profile'}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'catalogue' &&
        (selectedBookId === null ? (
          <CataloguePage onSelectBook={setSelectedBookId} />
        ) : (
          <BookDetailPage bookId={selectedBookId} onBack={() => setSelectedBookId(null)} />
        ))}

      {tab === 'lists' &&
        (selectedBookId !== null ? (
          <BookDetailPage bookId={selectedBookId} onBack={() => setSelectedBookId(null)} />
        ) : selectedListId === null ? (
          <ListsPage onSelectList={setSelectedListId} />
        ) : (
          <ListDetailPage
            listId={selectedListId}
            onBack={() => setSelectedListId(null)}
            onSelectBook={setSelectedBookId}
          />
        ))}

      {tab === 'profile' && <ProfilePage />}
    </>
  );
}
