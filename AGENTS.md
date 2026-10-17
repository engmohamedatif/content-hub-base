<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits that are already pushed — as it rewrites history on Lovable's side and the user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store data and authorization live in Lovable Cloud with row-level policies; this keeps private orders and administration server-verified.
- The catalog and checkout RPC live in `src/lib/store.functions.ts`, while page interactions use shared store context; this separates trusted pricing from browser state.
- Payment proofs use a private storage bucket and product photos use signed URLs from a private bucket; workspace policy disallows public buckets.
- Arabic customer pages and administrator pages use TanStack file routes; this gives each screen a shareable URL.
