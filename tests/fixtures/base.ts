import { test as base, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { STORAGE_STATE_PATH } from "../global-setup";

type Fixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ browser }, use) => {
    if (!existsSync(STORAGE_STATE_PATH)) {
      test.skip(
        true,
        `${STORAGE_STATE_PATH} missing — globalSetup did not run or test creds are unset.`,
      );
    }
    const ctx = await browser.newContext({ storageState: STORAGE_STATE_PATH });
    const page = await ctx.newPage();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
    await ctx.close();
  },
});

export { expect };
