# WorkTree X — Release Checklist

- [ ] All database migrations are forward-only and tested.
- [ ] No secret keys in client bundle (`git grep -i "sb_secret"`).
- [ ] Zero visual drift (all colors use CSS variables from `tokens.css`).
- [ ] Font strictly Inter.
- [ ] Desktop sidebar collapse operates at 76px and expands main content.
- [ ] Mobile bottom navigation renders at 74px + safe-area-inset-bottom.
- [ ] Multi-tenant isolation verified with two distinct organizations.
- [ ] Local server HTTP 200 OK.
