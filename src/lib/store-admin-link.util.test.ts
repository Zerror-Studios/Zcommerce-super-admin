import { describe, expect, it } from "vitest";
import { storeAdminLink } from "./store-admin-link.util";

const TEMPLATE = "https://store.zerrorstudios.com/store/{slug}";

describe("storeAdminLink (UX-26)", () => {
  it("builds the full store admin address, not just the fragment", () => {
    expect(storeAdminLink("deveshe", "a.b c", TEMPLATE)).toBe(
      "https://store.zerrorstudios.com/store/deveshe/#impersonation=a.b%20c",
    );
  });

  it("returns null without a slug, a token or a usable template", () => {
    expect(storeAdminLink(undefined, "t", TEMPLATE)).toBeNull();
    expect(storeAdminLink("s", "", TEMPLATE)).toBeNull();
    expect(storeAdminLink("s", "t", "")).toBeNull();
    expect(storeAdminLink("s", "t", "javascript:alert(1)/{slug}")).toBeNull();
  });

  it("accepts a fixed development address", () => {
    expect(storeAdminLink(null, "t", "http://localhost:5173/", true)).toBe(
      "http://localhost:5173/#impersonation=t",
    );
  });

  it("builds https links only outside a dev loopback host (W2V-C-06)", () => {
    expect(storeAdminLink(null, "t", "http://localhost:5173/", false)).toBeNull();
    expect(storeAdminLink("s", "t", "http://store.example/{slug}", true)).toBeNull();
    expect(storeAdminLink("s", "t", "http://store.example/{slug}", false)).toBeNull();
  });
});
