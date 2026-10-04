<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Stride uses the existing TanStack Start route system and a guarded vite-plugin-pwa service worker; this keeps offline plans available without affecting previews.
- Athlete and coach roles live in `user_roles`, separate from `profiles`; this prevents profile edits from escalating permissions.
