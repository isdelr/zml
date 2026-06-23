import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SongSubmissionForm } from "@/components/SongSubmissionForm";

const {
  checkForPotentialDuplicatesMock,
  getSongMetadataFromLinkMock,
  submitSongMock,
} = vi.hoisted(() => ({
  checkForPotentialDuplicatesMock: vi.fn(),
  getSongMetadataFromLinkMock: vi.fn(),
  submitSongMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: vi.fn(() => getSongMetadataFromLinkMock),
  useConvex: vi.fn(() => ({
    query: checkForPotentialDuplicatesMock,
  })),
  useMutation: vi.fn(() => submitSongMock),
}));

vi.mock("@/components/ui/media-image", () => ({
  MediaImage: ({ alt }: { alt: string }) => <div aria-label={alt} role="img" />,
}));

vi.mock("@/lib/storage/useUploadFile", () => ({
  useUploadFile: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/storage/useUploadSubmissionSongFile", () => ({
  useUploadSubmissionSongFile: vi.fn(() => vi.fn()),
}));

vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
}));

const round = {
  _id: "round-1",
  leagueId: "league-1",
} as never;

describe("SongSubmissionForm", () => {
  beforeEach(() => {
    checkForPotentialDuplicatesMock.mockReset();
    checkForPotentialDuplicatesMock.mockResolvedValue({
      artistExists: false,
      songExists: false,
    });
    getSongMetadataFromLinkMock.mockReset();
    getSongMetadataFromLinkMock.mockResolvedValue({
      submissionType: "youtube",
      songTitle: "Fetched Title",
      artist: "Fetched Artist",
      albumArtUrl: "https://i.ytimg.com/vi/abc123def45/maxresdefault.jpg",
      duration: 213,
      regionRestriction: null,
    });
    submitSongMock.mockReset();
    submitSongMock.mockResolvedValue(undefined);
  });

  it("submits edited YouTube metadata after auto-filling link details", async () => {
    const user = userEvent.setup();

    render(<SongSubmissionForm round={round} />);

    await user.click(screen.getByRole("tab", { name: "YouTube" }));
    fireEvent.change(await screen.findByLabelText("YouTube Link"), {
      target: { value: "https://youtu.be/abc123def45" },
    });

    const titleInput = await screen.findByDisplayValue("Fetched Title");
    const artistInput = screen.getByDisplayValue("Fetched Artist");
    const albumInput = screen.getByLabelText("Album");

    expect(titleInput).toBeEnabled();
    expect(artistInput).toBeEnabled();
    expect(albumInput).toBeEnabled();

    fireEvent.change(titleInput, { target: { value: "Edited Title" } });
    fireEvent.change(artistInput, { target: { value: "Edited Artist" } });
    fireEvent.change(albumInput, { target: { value: "Edited Album" } });

    fireEvent.click(screen.getByRole("button", { name: "Submit Song" }));

    await waitFor(() => expect(submitSongMock).toHaveBeenCalledTimes(1));
    expect(submitSongMock).toHaveBeenCalledWith({
      roundId: "round-1",
      submissionType: "youtube",
      songTitle: "Edited Title",
      artist: "Edited Artist",
      albumName: "Edited Album",
      year: undefined,
      songLink: "https://youtu.be/abc123def45",
      albumArtUrlValue: "https://i.ytimg.com/vi/abc123def45/maxresdefault.jpg",
      comment: "",
      duration: 213,
    });
  });
});
