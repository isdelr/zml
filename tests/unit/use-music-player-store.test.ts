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
      repeatMode: "none",
      isShuffled: false,
      seekTo: null,
      volume: 1,
      currentTime: 0,
      duration: 0,
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
    });
  });
});
