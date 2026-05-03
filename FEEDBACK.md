# Uniswap API Feedback

We used the Trading API for two flows in Zuno: standalone swaps from the
CLI, and pre-rebalance prep swaps when an LP plan needs a single-sided
position rebalanced into the right token ratio before the mint. Both run
from a backend Turnkey-signed agent wallet, no browser.

## What worked
- The `/check_approval -> /quote -> /swap` sequence is straightforward
  once you know the response shapes. The state machine maps cleanly to a
  CLI approve/review loop.
- The `routingPreference` enum (`BEST_PRICE` / `FASTEST`) and the separate
  `protocols` knob are well-named once you understand they do different
  things, routing strategy vs venue allowlist.
- The API is fully usable from a Node backend without a browser wallet
  context. For an agent that signs server-side, that matters.

## What was friction
- **Response shapes are deeper than the quickstarts imply.** The
  `quote.swap.transaction` shape (and the `permitData` block when Permit2
  is enabled) only appears in the reference pages, not in the high-level
  guides. We ended up reading the reference to know what to destructure.
- **Docs are split across several pages with no compact backend example.**
  A single page that walks `check_approval -> quote -> swap -> send` end
  to end with a Node code block would be a useful addition for backend
  integrators.
- **The Permit2-vs-plain-approval choice is not surfaced early.** The
  guides nudge toward Permit2 without flagging that backend agents can
  opt out via `x-permit2-enabled: false` and fall back to a plain ERC-20
  approval. We wired Permit2 typed-data signing first, then realized the
  header opt-out matched our threat model better. Calling out the choice
  in the quickstart, with a one-line decision tree (browser wallet =>
  Permit2; backend EOA => either, opt-out is fine), would unblock teams
  in our shape.

## What we would want
- **One copy-paste backend example.** A single page that runs
  `check_approval -> quote -> swap -> send` against a Node EOA, with both
  the Permit2 and the `x-permit2-enabled: false` paths shown side by
  side.
- **A clearer Permit2 decision note in the quickstart.** When to use it,
  when to skip it, and what the trade-offs are for a backend signer.
- **A bridge example for agent / approval-loop apps.** Showing how the
  swap flow fits into a "propose -> human approves -> agent executes"
  pattern, not just a one-shot swap, would map directly onto the kind of
  app the Trading API encourages.
- **A chain x protocol support matrix.** A single endpoint or doc table
  showing which chains currently route through v2, v3, and v4. We hit
  this question while wiring multi-chain support and ended up grepping
  the reference per chain.

## What is missing
- **No "mint position" primitive in the same surface.** The Trading API
  covers swaps cleanly, but an LP-management app like Zuno spends most
  of its time minting and rebalancing positions, not just swapping.
  Having a single bundled call that quotes "swap X into the right ratio,
  then mint a position with these ticks" (the prep-swap + mint as one
  atomic flow) would remove the most fragile glue code in our pipeline.
  Even just an authoritative quote endpoint for "what amounts will land
  in a v4 position at these ticks given this capital" would help.
- **No streaming / subscription option for quote freshness.** For a
  human-in-the-loop approval (Zuno shows the plan, waits for user
  approval, then signs), the quote can stale between proposal and
  execution. A "refresh quote" endpoint that returns just the deltas
  versus the original quote would let us re-confirm cheaply at apply
  time.
