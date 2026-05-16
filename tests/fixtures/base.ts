import { test as base, expect, type Page } from "@playwright/test";
import { loginAsTestUser, hasTestCreds } from "../helpers/auth";

/**
 * Project-wide fixtures. Import `test` and `expect` from here in new
 * specs so the `authenticatedPage` fixture is available without each
 * spec re-implementing login.
 */
type Fixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    if (!hasTestCreds()) {
      test.skip(true, "TEST_USER_EMAIL + TEST_USER_PASSWORD not set");
    }
    const ok = await loginAsTestUser(page);
    if (!ok) test.skip(true, "login failed — check test-user provisioning");
    // `use` is Playwright's fixture-provide API, not a React Hook —
    // the rule can't tell them apart inside test files.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect };
