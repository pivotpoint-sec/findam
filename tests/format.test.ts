import { describe, expect, it } from "vitest";
import { distance, displayPhone, naira, normalisePhone, priceRange, slugify } from "@/lib/format";
import { searchTokens } from "@/lib/search";

describe("normalisePhone", () => {
  it.each([
    ["08012345678", "+2348012345678"],
    ["0801 234 5678", "+2348012345678"],
    ["+234 801 234 5678", "+2348012345678"],
    ["2348012345678", "+2348012345678"],
    ["002348012345678", "+2348012345678"],
    ["09012345678", "+2349012345678"],
    ["07012345678", "+2347012345678"],
  ])("%s -> %s", (input, out) => expect(normalisePhone(input)).toBe(out));

  it.each(["", "12345", "+447700900123", "0601234567", "080123456789"])("rejects %s", (input) => {
    expect(normalisePhone(input)).toBeNull();
  });
});

describe("display helpers", () => {
  it("formats phones", () => expect(displayPhone("+2348012345678")).toBe("0801 234 5678"));
  it("formats naira", () => {
    expect(naira(1500)).toBe("₦1,500");
    expect(naira(15000)).toBe("₦15k");
    expect(naira(2_500_000)).toBe("₦2.5m");
    expect(priceRange(15000, 45000)).toBe("₦15k–₦45k");
  });
  it("formats distance", () => {
    expect(distance(348)).toBe("350 m");
    expect(distance(2430)).toBe("2.4 km");
    expect(distance(15200)).toBe("15 km");
  });
  it("slugifies", () => expect(slugify("Mama Tolú's Kitchen!")).toBe("mama-tolu-s-kitchen"));
});

describe("searchTokens", () => {
  it("drops English and Pidgin filler words", () => {
    expect(searchTokens("Where I fit fix my gen for Ikeja")).toEqual(["fix", "gen", "ikeja"]);
    expect(searchTokens("best AC repair near me")).toEqual(["ac", "repair"]);
  });
});
