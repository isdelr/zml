import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDiscordUserInfo } from "@/lib/auth/discord-user-info";

describe("discord user info gating", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.DISCORD_SERVER_ID = "allowed-server";
  });

  it("rejects non-members before requesting the Discord profile", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "other-server" }]), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDiscordUserInfo({ accessToken: "discord-token" });

    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/users/@me/guilds",
      expect.objectContaining({
        headers: { Authorization: "Bearer discord-token" },
      }),
    );
  });
});
