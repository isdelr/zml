import { beforeEach, describe, expect, it } from "vitest";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";

const makeSong = (id: string): Song => ({
  _id: id as never,
  roundId: "round-1" as never,
  leagueId: "league-1" as never,
  songTitle: `Song ${id}`,
  artist: "Artist",
  albumArtUrl: null,
  songFileUrl: `https://example.com/${id}.mp3`,
  songLink: null,
  submissionType: "file",
});

describe("useMusicPlayerStore", () => {
  beforeEach(() => {
    useMusicPlayerStore.setState({
      queue: [],
      originalQueue: [],
      currentTrackIndex: null,
      isPlaying: false,
      presenceSource: null,
      repeatMode: "none",
      isShuffled: false,
      seekTo: null,
      volume: 1,
      isContextViewOpen: false,
      listenProgress: {},
    });
  });

  it("keeps playback active when moving to the previous track", () => {
    const songs = [makeSong("one"), makeSong("two")];
    const { actions } = useMusicPlayerStore.getState();

    actions.playRound(songs, 1);
    useMusicPlayerStore.setState({ isPlaying: false });

    actions.playPrevious();

    expect(useMusicPlayerStore.getState()).toMatchObject({
      currentTrackIndex: 0,
      isPlaying: true,
      presenceSource: "player",
    });
  });

  it("opens the context view when a track is active", () => {
    const { actions } = useMusicPlayerStore.getState();

    actions.playSong(makeSong("one"));
    actions.openContextView();

    expect(useMusicPlayerStore.getState().isContextViewOpen).toBe(true);
  });

  it("switches presence back to the player when resuming a file track", () => {
    const { actions } = useMusicPlayerStore.getState();

    actions.playSong(makeSong("one"));
    useMusicPlayerStore.setState({
      isPlaying: false,
      presenceSource: "youtubePlaylist",
    });

    actions.togglePlayPause();

    expect(useMusicPlayerStore.getState()).toMatchObject({
      isPlaying: true,
      presenceSource: "player",
    });
  });

  it("does not open the context view when no track is active", () => {
    const { actions } = useMusicPlayerStore.getState();

    actions.openContextView();

    expect(useMusicPlayerStore.getState().isContextViewOpen).toBe(false);
  });
});
