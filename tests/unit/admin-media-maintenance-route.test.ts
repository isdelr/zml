import { beforeEach, describe, expect, it, vi } from "vitest";

const setAdminAuthMock = vi.fn();
const queryMock = vi.fn();
const actionMock = vi.fn();
const mutationMock = vi.fn();

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAdminAuth(value: string) {
      setAdminAuthMock(value);
    }

    query = queryMock;
    action = actionMock;
    mutation = mutationMock;
  },
}));

vi.mock("@/convex/b2Storage", () => ({
  B2Storage: class {},
}));

describe("admin media maintenance route", () => {
  beforeEach(() => {
    vi.resetModules();
    setAdminAuthMock.mockReset();
    queryMock.mockReset();
    actionMock.mockReset();
    mutationMock.mockReset();
    process.env.CONVEX_SELF_HOSTED_URL = "http://localhost:3210";
    process.env.MEDIA_MAINTENANCE_SECRET = "maintenance-secret";
  });

  it("rejects callers without the maintenance secret", async () => {
    const { POST } = await import("@/app/api/admin/media/maintenance/route");
    const response = await POST(
      new Request("http://localhost/api/admin/media/maintenance", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "audit-orphans" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(setAdminAuthMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
    expect(actionMock).not.toHaveBeenCalled();
    expect(mutationMock).not.toHaveBeenCalled();
  });
});
