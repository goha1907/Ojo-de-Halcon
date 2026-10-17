import { describe, expect, it } from "vitest";
import { publicSiteUrl } from "./create-bot";

describe("publicSiteUrl", () => {
  it("gives a button address only for a public https site", () => {
    expect(publicSiteUrl("https://ojodehalcon.com")).toBe("https://ojodehalcon.com/");
    for (const value of ["http://ojodehalcon.com", "http://localhost:3000", "https://localhost:3000", "https://192.168.1.5", "https://127.0.0.1", "not a url", "", undefined]) {
      expect(publicSiteUrl(value)).toBeNull();
    }
  });
});
