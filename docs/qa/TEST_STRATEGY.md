# WorkTree X — Test Strategy

## 5-Tier Testing Pyramid
1. **Unit Tests:** Pure functions (validation, permission rules, date calculations).
2. **Integration Tests:** Supabase repository queries and RPC invocations.
3. **Database Security Tests:** SQL assertion scripts verifying RLS isolation between tenants.
4. **E2E Tests:** Full browser user journeys (Playwright/Puppeteer/Cypress).
5. **Visual Regression:** 7-viewport matrix verification across light and dark themes.
