import { describe, expect, it } from "vitest";

import { buildUserAvatarMediaUrl } from "@/lib/media/delivery";

describe("buildUserAvatarMediaUrl", () => {
  it("returns the stable avatar path when no cache version is available", async () => {
    await expect(
      buildUserAvatarMediaUrl({
        userId: "user-1",
        storageKey: "avatars/user-1.webp",
      }),
    ).resolves.toBe("/api/media/users/user-1/avatar");
  });

  it("appends a cache-busting version when the cached avatar changes", async () => {
    const first = await buildUserAvatarMediaUrl({
      userId: "user-1",
      storageKey: "avatars/user-1.webp",
      version: 101,
    });
    const second = await buildUserAvatarMediaUrl({
      userId: "user-1",
      storageKey: "avatars/user-1.webp",
      version: 202,
    });

    expect(first).toMatch(/^\/api\/media\/users\/user-1\/avatar\?v=/u);
    expect(second).toMatch(/^\/api\/media\/users\/user-1\/avatar\?v=/u);
    expect(second).not.toBe(first);
  });
});
