# Exercise C — design comparison: what changed with design direction

Both rounds built the same feature against the same running API, with the same model,
in the same session. The only variable was the brief:
[Part 1 (no design direction)](part1-prompt.md) vs
[Part 2 (with design direction)](part2-prompt.md).

Part 1 lives outside the repo (it was a throwaway experiment); Part 2 is what shipped
into `apps/web`.

## The result that surprised me

**Part 1 was not ugly.** I expected the standard "no direction" outcome — Bootstrap
blue, a bare `<table>`, Times New Roman. Instead it independently produced a warm
off-white page, serif book titles, a bordered card grid, genre pills and a working
dark-mode block. Aesthetically it is in the same family as Part 2.

So the honest headline is not *"direction makes it pretty"*. It is:

> Modern models have a default taste, and it is decent. What design direction buys is
> **control and specificity** — the things a default has no way to guess.

## Measured differences

| | Part 1 (no direction) | Part 2 (with direction) |
|---|---|---|
| Responsive strategy | one `auto-fill minmax(16rem, 1fr)` grid, **0 media queries** | explicit 1 → 2 → 3 → 4 columns, **22 breakpoint utilities** (13 `sm:`, 7 `lg:`, 2 `xl:`) |
| Content width | capped at `60rem` (960px) — ~25% of a 1280px screen unused | `max-w-7xl` (1280px), fills the viewport |
| Card hover | **none** — hover styles exist only on the clear and retry buttons | 2px lift + border warms to accent + soft shadow, 150ms |
| `prefers-reduced-motion` | **not handled** | honoured (shimmer stops, transitions collapse) |
| Focus visibility | on 3 specific elements | one global `:focus-visible` accent ring |
| Types | **redeclared locally** in a 47-line `types.ts` | imported from `@bookshelf/shared` |
| CSS | 223 lines of bespoke CSS | 127 lines, mostly tokens; 0 raw hex in any component |
| Loading state | text | shimmer skeleton cards matching real card geometry |
| Fields shown | the 4 requested | + description (clamped), ISBN, `matchedOn` |

## What actually mattered, in order

1. **Type reuse was the biggest real win, and it is not a design point.** Part 1 could
   not see `@bookshelf/shared`, so it wrote its own `Book` interface. That is a
   guaranteed future bug: the API changes a field, the frontend keeps compiling, and
   nothing fails until runtime. Part 2 imports the same types the API validates
   against. *Pointing the AI at existing code beat describing what I wanted.*
2. **Breakpoints were the biggest visual win.** `auto-fill` is responsive in the loose
   sense but nobody chose the numbers. Naming "1 → 2 → 3 → 4, gap grows" produced a
   layout that looks deliberate at every width.
3. **Tokens made dark mode a 7-line change.** Because the brief said "define tokens, no
   raw hex in components", the entire dark palette is one overriding block and no
   component mentions a colour. Part 1's palette was also variable-driven (credit where
   due) but spread through 223 hand-written lines.
4. **Affordance was invisible until asked for.** Nobody specifies hover states
   unprompted, so Part 1 had none, and its cards read as static blocks.

## The part that has nothing to do with design direction

**I shipped a real bug in Part 2, with a detailed design brief in hand.**

I wrote the dark palette as `@media (prefers-color-scheme: dark) { @theme { … } }`.
Tailwind v4 hoists `@theme` out of any wrapping at-rule, so the dark values were emitted
unconditionally — **the app rendered dark in light mode too**. It looked correct,
because my browser was in dark mode. It compiled, it built, `tsc` was silent, and the
screenshot looked exactly as intended.

It was caught by one thing only: loading the running app in light mode and reading the
computed value of `--color-paper`. The fix is in
[`index.css`](../../apps/web/src/index.css) with a comment so it cannot come back.

Second, smaller one: `<input type="search">` draws its own native × in Chrome, which sat
next to the styled clear button — two × glyphs in one field. Also invisible in code,
also only caught by looking.

> Design direction improves what the AI aims at. It does nothing for correctness. Both
> defects here were in code I wrote to a detailed spec, and both were only findable in a
> browser.

## What I would do differently

Write the design brief once, as a file, and keep it — `CLAUDE.md`'s frontend conventions
section now carries the durable half of it (tokens, mobile-first, no CSS beyond
`index.css`), so the next component does not need the brief re-typed. That is the whole
argument for `CLAUDE.md` in one sentence: Part 2's brief was ~700 words and I should
never have to write them twice.
