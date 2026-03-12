import { describe, expect, it } from "vitest";
import {
  getAllowedDiscordServerIdsFromEnv,
  getPrimaryDiscordServerIdFromEnv,
  isAllowedDiscordServerId,
} from "@/lib/discord/server-access";

describe("discord server access helpers", () => {
  it("parses a comma-separated allowlist and removes blanks", () => {
    expect(
      getAllowedDiscordServerIdsFromEnv(" 123 , 456, ,123 , 789 "),
    ).toEqual(["123", "456", "789"]);
  });

  it("returns the first configured server as the primary server", () => {
    expect(getPrimaryDiscordServerIdFromEnv("123,456")).toBe("123");
    expect(getPrimaryDiscordServerIdFromEnv("")).toBeNull();
  });

  it("checks whether a server id is allowed", () => {
    expect(isAllowedDiscordServerId("456", "123,456")).toBe(true);
    expect(isAllowedDiscordServerId("999", "123,456")).toBe(false);
  });
});
