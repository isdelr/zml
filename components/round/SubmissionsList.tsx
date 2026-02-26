"use client";

import { useEffect, useMemo, useRef, Fragment } from "react";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { LeagueData } from "@/lib/convex/types";
import { SubmissionItem } from "./SubmissionItem";
import { Song } from "@/types";
import { toast } from "sonner";
import { toErrorMessage } from "@/lib/errors";

type SubmissionsListPropsSubmissions = FunctionReturnType<
  typeof api.submissions.getForRound
>;
type Submission = SubmissionsListPropsSubmissions[number];
type UserVoteStatus = FunctionReturnType<typeof api.votes.getForUserInRound>;
type BookmarkedSong = FunctionReturnType<
  typeof api.bookmarks.getBookmarkedSongs
>[number];
type SubmissionListener = {
  name?: string | null;
  image?: string | null;
  _id: Id<"users">;
};

interface SubmissionsListProps {
  submissions: SubmissionsListPropsSubmissions | undefined;
  userVoteStatus: UserVoteStatus | undefined;
  userVotes: Doc<"votes">[];
  currentUser: Doc<"users"> | null | undefined;
  roundStatus: "voting" | "finished" | "submissions";
  league: LeagueData;
  currentTrackIndex: number | null;
  isPlaying: boolean;
  queue: Song[];
  onPlaySong: (song: Song, index: number) => void;
  onVoteClick: (submissionId: Id<"submissions">, delta: 1 | -1) => void;
  isReadyToVoteOverall: boolean;
  listenProgressMap: Record<string, Doc<"listenProgress">>;
  activeCommentsSubmissionId: Id<"submissions"> | null;
  onToggleComments: (submissionId: Id<"submissions"> | null) => void;
  listenersBySubmission: Record<string, SubmissionListener[]> | undefined;
  onReachYouTube?: () => void;
  ytInfo?: {
    running: boolean;
    done?: boolean;
    remainingSec: number;
    videoCount: number;
    totalDurationSec: number;
    onOpen: () => void;
  };
}

export function SubmissionsList({
                                  submissions,
                                  userVoteStatus,
                                  userVotes,
                                  currentUser,
                                  roundStatus,
                                  league,
                                  currentTrackIndex,
                                  isPlaying,
                                  queue,
                                  onPlaySong,
                                  onVoteClick,
                                  listenProgressMap,
                                  isReadyToVoteOverall,
                                  activeCommentsSubmissionId,
                                  onToggleComments,
                                  listenersBySubmission,
                                  onReachYouTube,
                                ytInfo,
                                }: SubmissionsListProps) {
  const toSong = (submission: Submission): Song => ({
    ...submission,
    albumArtUrl: submission.albumArtUrl ?? "/icons/web-app-manifest-192x192.png",
    songFileUrl: submission.songFileUrl ?? null,
    songLink: submission.songLink ?? null,
  });

  const toggleBookmark = useMutation(
    api.bookmarks.toggleBookmark,
  ).withOptimisticUpdate((localStore, { submissionId }) => {
    let updatedSong: Submission | null = null;
    let newBookmarkState = false;

    const roundQueries = localStore.getAllQueries(api.submissions.getForRound);
    for (const { args, value } of roundQueries) {
      if (!value) continue;
      let updated = false;
      const newSubs = value.map((submission) => {
        if (submission._id === submissionId) {
          updated = true;
          return { ...submission, isBookmarked: !submission.isBookmarked };
        }
        return submission;
      });
      if (!updated) continue;
      localStore.setQuery(api.submissions.getForRound, args, newSubs);
      const changedSubmission = newSubs.find((s) => s._id === submissionId) ?? null;
      if (changedSubmission) {
        updatedSong = changedSubmission;
        newBookmarkState = changedSubmission.isBookmarked;
      }
    }

    const bookmarkedQueries = localStore.getAllQueries(
      api.bookmarks.getBookmarkedSongs,
    );
    for (const { args, value: bookmarkedSongs } of bookmarkedQueries) {
      if (!bookmarkedSongs || !updatedSong) continue;
      if (newBookmarkState) {
        const exists = bookmarkedSongs.some((s) => s._id === submissionId);
        if (!exists) {
          const bookmarkedSong: BookmarkedSong = {
            ...updatedSong,
            isBookmarked: true,
          };
          localStore.setQuery(api.bookmarks.getBookmarkedSongs, args, [
            ...bookmarkedSongs,
            bookmarkedSong,
          ]);
        }
      } else {
        const filtered = bookmarkedSongs.filter(
          (s) => s._id !== submissionId,
        );
        localStore.setQuery(api.bookmarks.getBookmarkedSongs, args, filtered);
      }
    }
  });


  const hasVoted = userVoteStatus?.hasVoted ?? false;
  const canVote = userVoteStatus?.canVote ?? false;

  // Determine the first YouTube submission index for observer
  const firstYouTubeIndex = useMemo(() => {
    if (!submissions || submissions.length === 0) return -1;
    return submissions.findIndex(
      (s) => s.submissionType === "youtube" && !!s.songLink,
    );
  }, [submissions]);

  const ytSentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!onReachYouTube) return;
    if (firstYouTubeIndex === -1) return;
    const el = ytSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          try { onReachYouTube(); } catch {}
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onReachYouTube, firstYouTubeIndex]);

  const currentTrack = currentTrackIndex !== null ? queue[currentTrackIndex] : null;

  const albumGroupMap = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return new Map<string, Submission[]>();
    }
    const map = new Map<string, Submission[]>();
    submissions.forEach((submission) => {
      if (submission.collectionType === "album" && submission.collectionId) {
        const entries = map.get(submission.collectionId) ?? [];
        entries.push(submission);
        map.set(submission.collectionId, entries);
      }
    });
    for (const [collectionId, tracks] of map.entries()) {
      tracks.sort((a, b) => {
        const aNum = a.trackNumber ?? 0;
        const bNum = b.trackNumber ?? 0;
        if (aNum === bNum) {
          return a.songTitle.localeCompare(b.songTitle);
        }
        return aNum - bNum;
      });
      map.set(collectionId, tracks);
    }
    return map;
  }, [submissions]);
  const handleBookmark = async (submissionId: Id<"submissions">) => {
    try {
      await toggleBookmark({ submissionId });
    } catch (err: unknown) {
      toast.error(toErrorMessage(err, "Failed to update bookmark."));
    }
  };

  if (!submissions || submissions.length === 0) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold">No Submissions</h2>
        <p className="mt-2 text-muted-foreground">
          Looks like no one submitted a track for this round.
        </p>
      </div>
    );
  }

  const renderSubmission = (
    submission: Submission,
    index: number,
  ) => {
    const submissionId = submission._id;
    const submissionKey = submissionId.toString();
    const isThisSongPlaying = isPlaying && currentTrack?._id === submissionId;
    const isThisSongCurrent = currentTrack?._id === submissionId;
    const userIsSubmitter = submission.userId === currentUser?._id;
    const isCommentsVisible = activeCommentsSubmissionId === submissionId;
    const listeners = listenersBySubmission?.[submissionKey] ?? [];

    const userVoteOnThisSong = userVotes.find(
      (v) => v.submissionId === submissionId,
    );
    const currentVoteValue = userVoteOnThisSong ? userVoteOnThisSong.vote : 0;

    return (
      <SubmissionItem
        key={submissionId}
        song={toSong(submission)}
        index={index}
        isThisSongPlaying={isThisSongPlaying}
        isThisSongCurrent={isThisSongCurrent}
        isCommentsVisible={isCommentsVisible}
        userIsSubmitter={userIsSubmitter}
        currentVoteValue={currentVoteValue}
        roundStatus={roundStatus}
        league={league}
        hasVoted={hasVoted}
        canVote={canVote}
        onVoteClick={(delta) => onVoteClick(submissionId, delta)}
        onBookmark={() => handleBookmark(submissionId)}
        onPlaySong={() => onPlaySong(toSong(submission), index)}
        listenProgress={listenProgressMap[submissionKey]}
        isReadyToVoteOverall={isReadyToVoteOverall}
        onToggleComments={() =>
          onToggleComments(isCommentsVisible ? null : submissionId)
        }
        listeners={listeners}
        currentUser={currentUser}
      />
    );
  };

  const seenAlbumIds = new Set<string>();

  const formatDurationCompact = (totalSeconds: number) => {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const two = (n: number) => n.toString().padStart(2, "0");
    return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
  };

  const youtubeItems = firstYouTubeIndex === -1 ? [] : submissions.slice(firstYouTubeIndex);

  return (
    <div className="flex flex-col rounded-lg border mt-3">
      <div className="hidden border-b border-border text-xs font-semibold uppercase text-muted-foreground md:block">
        <div className="grid grid-cols-[auto_4fr_3fr_2fr_auto] items-center gap-4 px-4 py-2">
          <span className="w-10 text-center">#</span>
          <span>Track</span>
          <span>Submitted By</span>
          <span className="text-right">Points</span>
          <span className="w-44 text-center">Actions</span>
        </div>
      </div>

      {submissions.map((submission, index) => {
        const extended = submission;
        const elements: React.ReactNode[] = [];

        if (extended.collectionType === "album" && extended.collectionId) {
          if (!seenAlbumIds.has(extended.collectionId)) {
            seenAlbumIds.add(extended.collectionId);
            const tracks = albumGroupMap.get(extended.collectionId) ?? [];
            elements.push(
              <div
                key={`header-${extended.collectionId}`}
                className="bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">
                      {extended.collectionName || extended.songTitle}
                    </p>
                    <p>
                      {extended.collectionArtist || extended.artist}
                      {extended.collectionReleaseYear
                        ? ` • ${extended.collectionReleaseYear}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-xs uppercase tracking-wide">
                    Album Submission • {tracks.length} track
                    {tracks.length === 1 ? "" : "s"}
                  </div>
                </div>
                {extended.collectionNotes && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {extended.collectionNotes}
                  </p>
                )}
              </div>,
            );
          }
        }

        elements.push(renderSubmission(submission, index));

        return <Fragment key={extended._id}>{elements}</Fragment>;
      })}

      {roundStatus === "voting" && youtubeItems.length > 0 ? (
        <div className="m-2 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between gap-2 border-b border-primary/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">YouTube playlist</span>
              {ytInfo?.done ? (
                <span className="ml-2 text-success">Completed ✓</span>
              ) : ytInfo?.running ? (
                <span className="ml-2">Timer running: {ytInfo.videoCount} video{ytInfo.videoCount !== 1 ? "s" : ""} — <strong>{formatDurationCompact(ytInfo.remainingSec)}</strong> left</span>
              ) : (
                <span className="ml-2">{ytInfo?.videoCount ?? youtubeItems.length} YouTube track{(ytInfo?.videoCount ?? youtubeItems.length) !== 1 ? "s" : ""}, total {formatDurationCompact(ytInfo?.totalDurationSec ?? 0)} — pending</span>
              )}
            </div>
            {ytInfo && (
              <button
                type="button"
                className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium hover:bg-primary/20"
                onClick={ytInfo.onOpen}
                title="Open playlist in a new tab"
              >
                Open playlist
              </button>
            )}
          </div>

          <div ref={ytSentinelRef} aria-hidden className="h-1" />

          {youtubeItems.map((song) => {
            const isThisSongPlaying = isPlaying && currentTrack?._id === song._id;
            const isThisSongCurrent = currentTrack?._id === song._id;
            const userIsSubmitter = song.userId === currentUser?._id;
            const isCommentsVisible = activeCommentsSubmissionId === song._id;
            const listeners = listenersBySubmission
              ? listenersBySubmission[song._id.toString()]
              : [];
            const userVoteOnThisSong = userVotes.find((v) => v.submissionId === song._id);
            const currentVoteValue = userVoteOnThisSong ? userVoteOnThisSong.vote : 0;
            const indexInAll = submissions.indexOf(song);
            return (
              <SubmissionItem
                key={song._id}
                song={toSong(song)}
                index={indexInAll}
                isThisSongPlaying={isThisSongPlaying}
                isThisSongCurrent={isThisSongCurrent}
                isCommentsVisible={isCommentsVisible}
                userIsSubmitter={userIsSubmitter}
                currentVoteValue={currentVoteValue}
                roundStatus={roundStatus}
                hasVoted={hasVoted}
                league={league}
                canVote={canVote}
                onToggleComments={() => onToggleComments(isCommentsVisible ? null : song._id)}
                onVoteClick={(delta) => onVoteClick(song._id, delta)}
                onBookmark={() => handleBookmark(song._id)}
                onPlaySong={() => onPlaySong(toSong(song), indexInAll)}
                listenProgress={listenProgressMap[song._id.toString()]}
                isReadyToVoteOverall={isReadyToVoteOverall}
                listeners={listeners ?? []}
                currentUser={currentUser}
              />
            );
          })}
        </div>
      ) : (
        // Non-voting phases: render YouTube items as regular list items without the wrapper/header
        <>
          {youtubeItems.map((song) => {
            const isThisSongPlaying = isPlaying && currentTrack?._id === song._id;
            const isThisSongCurrent = currentTrack?._id === song._id;
            const userIsSubmitter = song.userId === currentUser?._id;
            const isCommentsVisible = activeCommentsSubmissionId === song._id;
            const listeners = listenersBySubmission
              ? listenersBySubmission[song._id.toString()]
              : [];
            const userVoteOnThisSong = userVotes.find((v) => v.submissionId === song._id);
            const currentVoteValue = userVoteOnThisSong ? userVoteOnThisSong.vote : 0;
            const indexInAll = submissions.indexOf(song);
            return (
              <SubmissionItem
                key={song._id}
                song={toSong(song)}
                index={indexInAll}
                isThisSongPlaying={isThisSongPlaying}
                isThisSongCurrent={isThisSongCurrent}
                isCommentsVisible={isCommentsVisible}
                userIsSubmitter={userIsSubmitter}
                currentVoteValue={currentVoteValue}
                roundStatus={roundStatus}
                hasVoted={hasVoted}
                league={league}
                canVote={canVote}
                onToggleComments={() => onToggleComments(isCommentsVisible ? null : song._id)}
                onVoteClick={(delta) => onVoteClick(song._id, delta)}
                onBookmark={() => handleBookmark(song._id)}
                onPlaySong={() => onPlaySong(toSong(song), indexInAll)}
                listenProgress={listenProgressMap[song._id.toString()]}
                isReadyToVoteOverall={isReadyToVoteOverall}
                listeners={listeners ?? []}
                currentUser={currentUser}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
