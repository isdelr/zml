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
      "https://discord.com/api/v10/users/@me/guilds",
      expect.objectContaining({
        headers: { Authorization: "Bearer discord-token" },
      }),
    );
  });

  it("accepts membership in any configured allowed server", async () => {
    process.env.DISCORD_SERVER_ID = "primary-server, allowed-server";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "allowed-server" }]), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "123456789012345678",
            username: "listener",
            global_name: "Listener",
            email: "listener@example.com",
            verified: true,
            avatar: null,
            discriminator: "0",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getDiscordUserInfo({ accessToken: "discord-token" });

    expect(result?.user.email).toBe("listener@example.com");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
