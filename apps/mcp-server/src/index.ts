import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { readBooks, readShelves } from './data';

/**
 * This process talks MCP over stdio. Never write to stdout except through the
 * SDK's own transport — a stray `console.log` here corrupts the JSON-RPC stream
 * and breaks every tool call. Use `console.error` for diagnostics instead.
 */

const server = new McpServer({ name: 'bookshelf', version: '0.1.0' });

const normalise = (value: string): string => value.trim().toLowerCase();

server.registerTool(
  'query_books',
  {
    title: 'Query books',
    description:
      'Search the BookShelf catalogue by title/author (substring, case-insensitive) and/or genre (exact, case-insensitive).',
    inputSchema: {
      title: z.string().optional(),
      author: z.string().optional(),
      genre: z.string().optional(),
    },
  },
  async ({ title, author, genre }) => {
    const books = await readBooks();
    const results = books.filter((book) => {
      if (title && !normalise(book.title).includes(normalise(title))) return false;
      if (author && !normalise(book.author).includes(normalise(author))) return false;
      if (genre && normalise(book.genre) !== normalise(genre)) return false;
      return true;
    });
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  },
);

server.registerTool(
  'get_book_stats',
  {
    title: 'Book catalogue stats',
    description: 'Aggregate stats: total books, count per genre, and the N most recently added.',
    inputSchema: { recentCount: z.number().int().min(1).max(50).optional() },
  },
  async ({ recentCount = 5 }) => {
    const books = await readBooks();

    const byGenre: Record<string, number> = {};
    for (const book of books) {
      byGenre[book.genre] = (byGenre[book.genre] ?? 0) + 1;
    }

    const mostRecent = [...books]
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .slice(0, recentCount)
      .map((book) => ({ id: book.id, title: book.title, addedAt: book.addedAt }));

    const stats = { total: books.length, byGenre, mostRecent };
    return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] };
  },
);

server.registerTool(
  'get_shelf_contents',
  {
    title: 'Shelf contents',
    description:
      'Reads data/shelves.json directly (read-only). Note: shelves have no repository/service/route in the API yet — this tool bypasses the app layer entirely and reads the seed file.',
    inputSchema: { shelfId: z.string().optional(), userId: z.string().optional() },
  },
  async ({ shelfId, userId }) => {
    const [shelves, books] = await Promise.all([readShelves(), readBooks()]);
    const titleById = new Map(books.map((book) => [book.id, book.title]));

    const results = shelves
      .filter((shelf) => (shelfId ? shelf.id === shelfId : true))
      .filter((shelf) => (userId ? shelf.userId === userId : true))
      .map((shelf) => ({
        ...shelf,
        books: shelf.bookIds.map((id) => titleById.get(id) ?? id),
      }));

    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  },
);

await server.connect(new StdioServerTransport());
