import { CataloguePage } from './pages/CataloguePage';

/**
 * Single page for now. When the book detail page and shelf management arrive there will
 * be a router here — deliberately not added today, since one page does not need one.
 */
export function App(): React.JSX.Element {
  return <CataloguePage />;
}
