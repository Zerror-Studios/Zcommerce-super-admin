import { describe, expect, it } from "vitest";
import { parentSourcesText } from "./platform-messaging-reconciliation.util";
import { topUpRequesterText } from "./platform-messaging-balance.util";

describe("messaging console helpers (backend PRD-050 D22)", () => {
  it("splits the parent row into shared-address and platform mail", () => {
    expect(parentSourcesText({ scope: "PARENT", parentSources: { storeShared: 1200, platformMail: 80, stores: 3 } })).toBe(
      "Shared address from 3 stores 1,200 · Zerror's own mail 80",
    );
    expect(parentSourcesText({ scope: "PARENT", parentSources: { storeShared: 5, platformMail: 0, stores: 1 } })).toBe(
      "Shared address from 1 store 5 · Zerror's own mail 0",
    );
    expect(parentSourcesText({ scope: "PARENT", parentSources: null })).toBe(
      "Shared-address mail sent through Zerror's account",
    );
    expect(parentSourcesText({ scope: "STORE", parentSources: null })).toBe("");
  });

  it("names an automatic top-up request", () => {
    expect(topUpRequesterText({ auto: true, requestedBy: "AUTO" })).toBe(
      "Automatic (balance under the store's threshold)",
    );
    expect(topUpRequesterText({ auto: false, requestedBy: "admin-1" })).toBe("By admin-1");
    expect(topUpRequesterText({ requestedBy: null })).toBeNull();
  });
});
