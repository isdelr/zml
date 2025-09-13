"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useMusicPlayerStore } from "@/hooks/useMusicPlayerStore";
import { Song } from "@/types";
import { dynamicImport } from "@/components/ui/dynamic-import";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { AvatarStack } from "./AvatarStack";
import { toast } from "sonner";
import { SubmissionCommentsPanel } from "./round/SubmissionCommentsPanel";
import { Ban, Headphones } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
// New imports for the confirmation dialog
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const RoundAdminControls = dynamicImport(() =>
  import("./round/RoundAdminControls").then((mod) => ({
    default: mod.RoundAdminControls,
  })),
);
const RoundHeader = dynamicImport(() =>
  import("./round/RoundHeader").then((mod) => ({ default: mod.RoundHeader })),
);
const SubmissionForm = dynamicImport(() =>
  import("./round/SubmissionForm").then((mod) => ({
    default: mod.SubmissionForm,
  })),
);
const SubmissionsList = dynamicImport(() =>
  import("./round/SubmissionsList").then((mod) => ({
    default: mod.SubmissionsList,
  })),
);
const RoundVoteSummary = dynamicImport(() =>
  import("./round/RoundVoteSummary").then((mod) => ({
    default: mod.RoundVoteSummary,
  })),
);

interface RoundDetailProps {
  round: Doc<"rounds"> & { art: string | null; submissionCount: number };
  league: NonNullable<Awaited<ReturnType<typeof api.leagues.get>>>;
  canManageLeague: boolean;
}

export function RoundDetail({ round, league, canManageLeague }: RoundDetailProps) {
  const {
    actions: playerActions,
    currentTrackIndex,
    isPlaying,
    queue,
  } = useMusicPlayerStore();

  const [isVoteSummaryVisible, setIsVoteSummaryVisible] = useState(false);
  const summaryTriggerRef = useRef<HTMLDivElement | null>(null);
  const [activeCommentsSubmissionId, setActiveCommentsSubmissionId] =
    useState<Id<"submissions"> | null>(null);
  // State for the confirmation dialog
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    submissionId: Id<"submissions"> | null;
    delta: 1 | -1 | null;
  }>({ isOpen: false, submissionId: null, delta: null });
  const [confirmText, setConfirmText] = useState("");

  const currentUser = useQuery(api.users.getCurrentUser);
  const listenersBySubmission = useQuery(api.presence.listForRound, {
    roundId: round._id,
  });
  const listenProgressData = useQuery(api.listenProgress.getForRound, {
    roundId: round._id,
  });
  const promotePresubs = useMutation(
    api.submissions.promotePresubmissionsForRound,
  );
  const promotedRef = useRef<string | null>(null);
  const submissions = useQuery(api.submissions.getForRound, {
    roundId: round._id,
  });
  const castVote = useMutation(api.votes.castVote).withOptimisticUpdate(
    (
      localStore,
      {
        submissionId,
        delta,
      }: { submissionId: Id<"submissions">; delta: 1 | -1 },
    ) => {
      const voteStatus = localStore.getQuery(api.votes.getForUserInRound, {
        roundId: round._id,
      });
      if (!voteStatus || !currentUser) return;

      const newVoteStatus = JSON.parse(
        JSON.stringify(voteStatus),
      ) as NonNullable<typeof voteStatus>;

      const idx = newVoteStatus.votes.findIndex(
        (v: Doc<"votes">) => v.submissionId === submissionId,
      );
      if (idx > -1) {
        const currentVal = newVoteStatus.votes[idx].vote;
        const nextVal = currentVal + delta;
        if (nextVal === 0) {
          newVoteStatus.votes.splice(idx, 1);
        } else {
          newVoteStatus.votes[idx].vote = nextVal;
        }
      } else {
        if (delta !== 0) {
          newVoteStatus.votes.push({
            _id: `optimistic_${submissionId}_${Date.now()}` as unknown as Id<"votes">,
            _creationTime: Date.now(),
            roundId: round._id,
            submissionId,
            userId: currentUser._id,
            vote: delta,
          });
        }
      }

      newVoteStatus.upvotesUsed = newVoteStatus.votes.reduce(
        (sum: number, v: Doc<"votes">) => sum + Math.max(0, v.vote),
        0,
      );
      newVoteStatus.downvotesUsed = newVoteStatus.votes.reduce(
        (sum: number, v: Doc<"votes">) => sum + Math.abs(Math.min(0, v.vote)),
        0,
      );

      const effectiveMaxUp = round.maxPositiveVotes ?? league.maxPositiveVotes;
      const effectiveMaxDown = round.maxNegativeVotes ?? league.maxNegativeVotes;
      newVoteStatus.hasVoted =
        newVoteStatus.upvotesUsed === effectiveMaxUp &&
        newVoteStatus.downvotesUsed === effectiveMaxDown;

      localStore.setQuery(
        api.votes.getForUserInRound,
        { roundId: round._id },
        newVoteStatus,
      );
    },
  );
  const userVoteStatus = useQuery(api.votes.getForUserInRound, {
    roundId: round._id,
  });
  const voters = useQuery(api.votes.getVotersForRound, { roundId: round._id });
  const votes = useQuery(api.votes.getForRound, { roundId: round._id });

  useEffect(() => {
    if (round.status === "submissions" && promotedRef.current !== round._id) {
      promotedRef.current = round._id as string;
      promotePresubs({ roundId: round._id }).catch((e) => {
        console.error("Failed to promote presubmissions:", e);
      });
    }
  }, [round._id, round.status, promotePresubs]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVoteSummaryVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px 200px 0px" },
    );

    if (summaryTriggerRef.current) {
      observer.observe(summaryTriggerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const listenProgressMap = useMemo(() => {
    if (!listenProgressData) return {};
    const map: Record<string, Doc<"listenProgress">> = {};
    for (const progress of listenProgressData) {
      if (progress) {
        map[progress.submissionId] = progress;
      }
    }
    return map;
  }, [listenProgressData]);

  const songsLeftToListen = useMemo(() => {
    if (!league.enforceListenPercentage || !submissions || !currentUser)
      return [];
    const requiredSubs = submissions.filter(
      (s) => ["file", "youtube"].includes(s.submissionType) && s.userId !== currentUser._id && !s.isTrollSubmission,
    );
    if (requiredSubs.length === 0) return [];
    return requiredSubs.filter(
      (sub) => listenProgressMap[sub._id]?.isCompleted !== true,
    );
  }, [
    league.enforceListenPercentage,
    submissions,
    currentUser,
    listenProgressMap,
  ]);

  const isReadyToVoteOverall = useMemo(() => {
    if (!league.enforceListenPercentage || !submissions || !currentUser)
      return true;
    const requiredSubs = submissions.filter(
      (s) => ["file", "youtube"].includes(s.submissionType) && s.userId !== currentUser._id && !s.isTrollSubmission,
    );
    if (requiredSubs.length === 0) return true;
    return requiredSubs.every(
      (sub) => listenProgressMap[sub._id]?.isCompleted === true,
    );
  }, [
    league.enforceListenPercentage,
    submissions,
    currentUser,
    listenProgressMap,
  ]);

  const sortedSubmissions = useMemo(() => {
    if (!submissions) return undefined;

    if (round.status === "finished") {
      return [...submissions].sort((a, b) => b.points - a.points);
    }

    const createSeed = (str: string) => {
      let seed = 0;
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        seed = (seed << 5) - seed + charCode;
        seed |= 0;
      }
      return seed;
    };

    const seededRandom = (seed: number) => {
      return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };

    const seed = createSeed(round._id);
    const random = seededRandom(seed);

    const shuffleArray = <T,>(array: T[]): T[] => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };

    const fileSubmissions = submissions.filter(
      (s) => s.submissionType === "file",
    );
    const linkSubmissions = submissions.filter(
      (s) =>  s.submissionType === "youtube",
    );

    const sortById = (
      a: { _id: Id<"submissions"> },
      b: { _id: Id<"submissions"> },
    ) => a._id.localeCompare(b._id);
    fileSubmissions.sort(sortById);
    linkSubmissions.sort(sortById);

    const shuffledFiles = shuffleArray(fileSubmissions);
    const shuffledLinks = shuffleArray(linkSubmissions);

    return [...shuffledFiles, ...shuffledLinks];
  }, [submissions, round.status, round._id]);

  const activeSubmissionForPanel = useMemo(() => {
    if (!activeCommentsSubmissionId || !sortedSubmissions) {
      return null;
    }
    return (
      sortedSubmissions.find((s) => s._id === activeCommentsSubmissionId) ??
      null
    );
  }, [activeCommentsSubmissionId, sortedSubmissions]);

  const handleConfirmFinalVote = () => {
    if (confirmationState.submissionId && confirmationState.delta) {
      castVote({
        submissionId: confirmationState.submissionId,
        delta: confirmationState.delta,
      })
        .then((result) => {
          if (result.isFinal) {
            toast.success(result.message);
          }
        })
        .catch((err) => {
          toast.error((err as Error).message || "Failed to save vote.");
        });
    }
    setConfirmationState({ isOpen: false, submissionId: null, delta: null });
    setConfirmText("");
  };

  const handleVoteClick = (submissionId: Id<"submissions">, delta: 1 | -1) => {
    if (userVoteStatus?.hasVoted) {
      toast.info("Your votes for this round are final and cannot be changed.");
      return;
    }

    const upvotesUsed = userVoteStatus?.upvotesUsed ?? 0;
    const downvotesUsed = userVoteStatus?.downvotesUsed ?? 0;

    // Current vote on this submission (0 if none)
    const currentVote =
      userVoteStatus?.votes.find((v) => v.submissionId === submissionId)
        ?.vote ?? 0;

    // Apply the click, clamp to league rules, and derive the actual delta to send
    let nextVote = currentVote + delta;
    if (league.limitVotesPerSubmission) {
      if (nextVote > (league.maxPositiveVotesPerSubmission ?? Infinity)) {
        nextVote = league.maxPositiveVotesPerSubmission ?? nextVote;
      }
      if (nextVote < -(league.maxNegativeVotesPerSubmission ?? Infinity)) {
        nextVote = -(league.maxNegativeVotesPerSubmission ?? nextVote);
      }
    }
    const deltaToSend = (nextVote - currentVote) as -1 | 0 | 1;

    if (deltaToSend === 0) return;

    // Predict post-click usage
    const nextUpvotesUsed =
      upvotesUsed - Math.max(0, currentVote) + Math.max(0, nextVote);
    const nextDownvotesUsed =
      downvotesUsed -
      Math.abs(Math.min(0, currentVote)) +
      Math.abs(Math.min(0, nextVote));

    // Only prompt if this click would actually make votes final
    const effectiveMaxUpClick = round.maxPositiveVotes ?? league.maxPositiveVotes;
    const effectiveMaxDownClick = round.maxNegativeVotes ?? league.maxNegativeVotes;
    const willBeFinal =
      nextUpvotesUsed === effectiveMaxUpClick &&
      nextDownvotesUsed === effectiveMaxDownClick;

    if (willBeFinal) {
      setConfirmationState({
        isOpen: true,
        submissionId,
        delta: deltaToSend as 1 | -1,
      });
      return;
    }

    castVote({ submissionId, delta: deltaToSend as 1 | -1 })
      .then((result) => {
        if (result.isFinal) {
          toast.success(result.message);
        }
      })
      .catch((err) => {
        toast.error((err as Error).message || "Failed to save vote.");
      });
  };

  const handlePlaySong = (song: Song, index: number) => {
    // For YouTube submissions, open playlist with that song first
    if (song.submissionType === "youtube") {
      if (youtubeVideoIds.length > 0) {
        const idx = youtubeData.findIndex((d) => d.submissionId === song._id);
        const ordered = idx >= 0
          ? [...youtubeVideoIds.slice(idx), ...youtubeVideoIds.slice(0, idx)]
          : youtubeVideoIds;
        openYouTubePlaylist(ordered);
        startPlaylistTimer(totalYouTubeDurationSec);
        try { sessionStorage.setItem(sessionOpenedKey, "1"); } catch {}
      }
      return;
    }

    // Default internal player flow for file submissions
    const isThisSongCurrent =
      currentTrackIndex !== null && queue[currentTrackIndex]?._id === song._id;
    if (isThisSongCurrent) {
      playerActions.togglePlayPause();
    } else {
      playerActions.playRound(sortedSubmissions as Song[], index);
    }
  };

  const handlePlaySongFromPanel = (song: Song) => {
    const indexInQueue =
      sortedSubmissions?.findIndex((s) => s._id === song._id) ?? -1;
    if (indexInQueue !== -1) {
      handlePlaySong(song, indexInQueue);
    } else {
      playerActions.playSong(song);
    }
  };

  const upvotesUsed = userVoteStatus?.upvotesUsed ?? 0;
  const downvotesUsed = userVoteStatus?.downvotesUsed ?? 0;
  const effectiveMaxUp = round.maxPositiveVotes ?? league.maxPositiveVotes;
  const effectiveMaxDown = round.maxNegativeVotes ?? league.maxNegativeVotes;
  const positiveVotesRemaining = Math.max(0, effectiveMaxUp - upvotesUsed);
  const negativeVotesRemaining = Math.max(0, effectiveMaxDown - downvotesUsed);
  const isVoteFinal = userVoteStatus?.hasVoted ?? false;
  const usesCustomLimits = (((round.maxPositiveVotes ?? null) !== null && round.maxPositiveVotes !== league.maxPositiveVotes) || ((round.maxNegativeVotes ?? null) !== null && round.maxNegativeVotes !== league.maxNegativeVotes));
  const totalDurationSeconds = useMemo(
    () =>
      submissions?.reduce((total, sub) => total + (sub.duration || 0), 0) ?? 0,
    [submissions],
  );
  const mySubmissions = useMemo(
    () => submissions?.filter((s) => s.userId === currentUser?._id),
    [submissions, currentUser],
  );

  // Helpers to build a temporary YouTube playlist from current round YouTube submissions
  const getYouTubeVideoId = (url: string): string | null => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Build ordered list of youtube submissions with ids and durations
  const youtubeData = useMemo(() => {
    if (!sortedSubmissions) return [] as { submissionId: Id<"submissions">; videoId: string; duration: number }[];
    const seen = new Set<string>();
    const list: { submissionId: Id<"submissions">; videoId: string; duration: number }[] = [];
    for (const s of sortedSubmissions) {
      if (s.submissionType === "youtube" && s.songLink) {
        const vid = getYouTubeVideoId(s.songLink);
        if (!vid || seen.has(vid)) continue;
        seen.add(vid);
        const dur = Number.isFinite(s.duration) && (s.duration ?? 0) > 0 ? Math.floor(s.duration as number) : 180;
        list.push({ submissionId: s._id, videoId: vid, duration: dur });
      }
    }
    return list;
  }, [sortedSubmissions]);

  const youtubeVideoIds = useMemo(() => youtubeData.map(d => d.videoId), [youtubeData]);
  const youtubeSubmissionIds = useMemo(() => youtubeData.map(d => d.submissionId), [youtubeData]);
  const totalYouTubeDurationSec = useMemo(() => youtubeData.reduce((sum, d) => sum + d.duration, 0), [youtubeData]);

  // Playlist open + consolidated timer management (per-round session)
  const sessionKey = useMemo(() => `ytPlaylist:${round._id}`, [round._id]);
  const sessionOpenedKey = `${sessionKey}:opened`;
  const sessionEndAtKey = `${sessionKey}:endAt`;
  const sessionDurationKey = `${sessionKey}:duration`;
  const sessionDoneKey = `${sessionKey}:done`;

  const [ytTimerRemainingSec, setYtTimerRemainingSec] = useState<number>(0);
  const [ytTimerRunning, setYtTimerRunning] = useState<boolean>(false);
  const [ytTimerDone, setYtTimerDone] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const markCompletedBatch = useMutation(api.listenProgress.markCompletedBatch);

  const completeYouTubeListening = useCallback(async () => {
    clearTimer();
    setYtTimerRunning(false);
    setYtTimerRemainingSec(0);
    setYtTimerDone(true);
    try {
      if (youtubeSubmissionIds.length > 0) {
        await markCompletedBatch({ roundId: round._id, submissionIds: youtubeSubmissionIds });
        // Optimistic local flag so UI reflects completion immediately
        youtubeSubmissionIds.forEach((id) => playerActions.setListenProgress(id as unknown as string, true));
      }
    } catch (e) {
      console.error("Failed to mark playlist listening complete", e);
    } finally {
      try {
        sessionStorage.removeItem(sessionEndAtKey);
        sessionStorage.removeItem(sessionDurationKey);
        localStorage.setItem(sessionDoneKey, "1");
      } catch {}
    }
  }, [clearTimer, youtubeSubmissionIds, markCompletedBatch, round._id, playerActions, sessionEndAtKey, sessionDurationKey, sessionDoneKey]);

  const startPlaylistTimer = (totalSec: number) => {
    if (!totalSec || totalSec <= 0) return;

    // Do not start if playlist already completed previously
    try {
      if (localStorage.getItem(sessionDoneKey) === "1") {
        setYtTimerDone(true);
        setYtTimerRunning(false);
        setYtTimerRemainingSec(0);
        return;
      }
    } catch {}

    // If a timer is already scheduled in this session and not expired, do not reset it
    try {
      const existingEndAt = sessionStorage.getItem(sessionEndAtKey);
      if (existingEndAt) {
        const remaining = Math.ceil((Number(existingEndAt) - Date.now()) / 1000);
        if (remaining > 0) {
          // Ensure UI reflects running state without resetting the end time
          setYtTimerRunning(true);
          setYtTimerRemainingSec(remaining);
          clearTimer();
          timerRef.current = window.setInterval(() => {
            const left = Math.max(0, Math.ceil((Number(sessionStorage.getItem(sessionEndAtKey)) - Date.now()) / 1000));
            setYtTimerRemainingSec(left);
            if (left <= 0) completeYouTubeListening();
          }, 1000);
          return;
        }
      }
    } catch {}

    const endAt = Date.now() + totalSec * 1000;
    try {
      sessionStorage.setItem(sessionEndAtKey, String(endAt));
      sessionStorage.setItem(sessionDurationKey, String(totalSec));
    } catch {}

    setYtTimerRunning(true);
    setYtTimerRemainingSec(totalSec);
    clearTimer();
    timerRef.current = window.setInterval(() => {
      const msLeft = (Number(sessionStorage.getItem(sessionEndAtKey)) || endAt) - Date.now();
      const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
      setYtTimerRemainingSec(secLeft);
      if (secLeft <= 0) {
        completeYouTubeListening();
      }
    }, 1000);
  };

  // Resume timer if present in sessionStorage or mark as done if completed previously
  useEffect(() => {
    try {
      const isDone = localStorage.getItem(sessionDoneKey) === "1";
      if (isDone) {
        setYtTimerDone(true);
        setYtTimerRunning(false);
        setYtTimerRemainingSec(0);
        // Ensure any stale session keys are cleared
        sessionStorage.removeItem(sessionEndAtKey);
        sessionStorage.removeItem(sessionDurationKey);
      } else {
        const endAtStr = sessionStorage.getItem(sessionEndAtKey);
        const durationStr = sessionStorage.getItem(sessionDurationKey);
        if (endAtStr && durationStr) {
          const endAt = Number(endAtStr);
          const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
          if (remaining > 0) {
            setYtTimerRunning(true);
            setYtTimerRemainingSec(remaining);
            clearTimer();
            timerRef.current = window.setInterval(() => {
              const left = Math.max(0, Math.ceil((Number(sessionStorage.getItem(sessionEndAtKey)) - Date.now()) / 1000));
              setYtTimerRemainingSec(left);
              if (left <= 0) completeYouTubeListening();
            }, 1000);
          } else if (endAtStr) {
            // Timer expired while away: complete now
            completeYouTubeListening();
          }
        }
      }
    } catch {}
    return () => clearTimer();
  }, [sessionEndAtKey, sessionDurationKey, sessionDoneKey, completeYouTubeListening, clearTimer]);

  const openYouTubePlaylist = (orderedIds: string[]) => {
    if (orderedIds.length === 0) return;
    const ids = orderedIds.slice(0, 50);
    const url = `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const ensureAutoOpenOnce = () => {
    if (youtubeVideoIds.length === 0) return;
    if (round.status !== "voting") return; // limit auto behavior to voting phase
    if (ytTimerDone) return; // if already completed, don't auto-open or start timer
    try {
      if (sessionStorage.getItem(sessionOpenedKey) === "1") return;
      sessionStorage.setItem(sessionOpenedKey, "1");
    } catch {}
    openYouTubePlaylist(youtubeVideoIds);
    // Start timer for ALL youtube songs (not only first 50)
    startPlaylistTimer(totalYouTubeDurationSec);
  };

  const submittedUsers = useMemo(() => {
    if (!submissions) return [] as { name: string | null; image: string | null }[];
    const required = (round).submissionsPerUser ?? 1;
    const counts = new Map<string, { name: string | null; image: string | null; count: number }>();
    for (const sub of submissions) {
      const key = (sub.userId as unknown as string) ?? sub.submittedBy ?? Math.random().toString();
      const existing = counts.get(key) ?? { name: sub.submittedBy, image: sub.submittedByImage, count: 0 };
      existing.count += 1;
      existing.name = sub.submittedBy; // latest name/image
      existing.image = sub.submittedByImage;
      counts.set(key, existing);
    }
    return Array.from(counts.values())
      .filter((e) => e.count >= required)
      .map(({ name, image }) => ({ name, image }));
  }, [submissions, round]);

  const formatDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds <= 0) return null;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts = [];
    if (hours > 0) parts.push(`${hours} hr`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (parts.length === 0) {
      const seconds = Math.round(totalSeconds % 60);
      parts.push(`${seconds} sec`);
    }
    return parts.join(" ");
  };

  return (
    <section>
      {canManageLeague && (
        <RoundAdminControls
          round={round}
          submissions={submissions}
          votes={votes}
        />
      )}

      {round.status === "voting" &&
        userVoteStatus &&
        !userVoteStatus.hasVoted &&
        !userVoteStatus.canVote && (
          <Alert className="mb-8 border-yellow-500/50 bg-yellow-500/10 text-yellow-400">
            <Ban className="size-4" />
            <AlertTitle className="font-bold">Voting Restricted</AlertTitle>
            <AlertDescription className="text-yellow-400/80">
              You must submit a song to a round to be eligible to vote.
            </AlertDescription>
          </Alert>
        )}

      <RoundHeader
        round={round}
        submissions={sortedSubmissions}
        onPlayAll={(songs, startIndex) =>
          playerActions.playRound(songs, startIndex)
        }
        positiveVotesRemaining={positiveVotesRemaining}
        negativeVotesRemaining={negativeVotesRemaining}
        hasVoted={isVoteFinal}
        upvotesUsed={upvotesUsed}
        downvotesUsed={downvotesUsed}
        totalDuration={formatDuration(totalDurationSeconds)}
        usesCustomLimits={usesCustomLimits}
        effectiveMaxUp={effectiveMaxUp}
        effectiveMaxDown={effectiveMaxDown}
        leagueMaxUp={league.maxPositiveVotes}
        leagueMaxDown={league.maxNegativeVotes}
      />


      {round.status === "voting" &&
        league.enforceListenPercentage &&
        songsLeftToListen.length > 0 && (
          <Alert className="mb-8 border-blue-500/50 bg-blue-500/10 text-blue-400">
            <AlertTitle className="font-bold text-xl mb-2">
              Listening Requirement
            </AlertTitle>
            <AlertDescription className="text-blue-800/80 dark:text-blue-400/80">
              <div className="flex gap-2 items-center">
                <span>
                  You have:{" "}
                  <span className="font-bold">{songsLeftToListen.length} </span>
                  <span className="font-bold">
                    {songsLeftToListen.length > 1 ? "songs" : "song"}
                  </span>{" "}
                  left to listen to, before you can vote. Unlistened file
                  submissions are marked with a
                </span>
                <Headphones className="inline-block size-4" />
              </div>
            </AlertDescription>
          </Alert>
        )}

      <div className="mt-8">
        <SubmissionForm
          round={round as Doc<"rounds">}
          roundStatus={round.status}
          currentUser={currentUser}
          mySubmissions={mySubmissions}
        />
        {round.status === "submissions" && (
          <div className="mt-8 rounded-lg border bg-card p-6 text-center">
            <h3 className="font-semibold">Who&apos;s Submitted So Far?</h3>
            {submittedUsers.length > 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center gap-2">
                <AvatarStack users={submittedUsers} />
                <p className="text-sm text-muted-foreground">
                  {submittedUsers.length} submission
                  {submittedUsers.length > 1 ? "s" : ""}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No one has submitted yet. Be the first!
              </p>
            )}
          </div>
        )}
      </div>

      {/* YouTube playlist info banner removed in favor of inline wrapper in the list */}

      {(round.status === "voting" || round.status === "finished") && (
        <>
          {round.status === "voting" && voters && voters.length > 0 && (
            <div className="my-8 rounded-lg border bg-card p-6 text-center">
              <h3 className="font-semibold">Who&apos;s Voted So Far?</h3>
              <div className="mt-4 flex flex-col items-center justify-center gap-2">
                <AvatarStack users={voters} />
                <p className="text-sm text-muted-foreground">
                  {voters.length} member{voters.length !== 1 ? "s" : ""} have
                  cast their votes.
                </p>
              </div>
            </div>
          )}
          <SubmissionsList
            submissions={sortedSubmissions}
            userVoteStatus={userVoteStatus}
            userVotes={userVoteStatus?.votes ?? []}
            currentUser={currentUser}
            roundStatus={round.status}
            league={league}
            currentTrackIndex={currentTrackIndex}
            isPlaying={isPlaying}
            queue={queue}
            onPlaySong={handlePlaySong}
            onVoteClick={handleVoteClick}
            listenProgressMap={listenProgressMap}
            isReadyToVoteOverall={isReadyToVoteOverall}
            activeCommentsSubmissionId={activeCommentsSubmissionId}
            onToggleComments={setActiveCommentsSubmissionId}
            listenersBySubmission={listenersBySubmission}
            onReachYouTube={ensureAutoOpenOnce}
            ytInfo={{
              running: ytTimerRunning,
              done: ytTimerDone,
              remainingSec: ytTimerRemainingSec,
              videoCount: youtubeVideoIds.length,
              totalDurationSec: totalYouTubeDurationSec,
              onOpen: () => {
                openYouTubePlaylist(youtubeVideoIds);
                if (!ytTimerDone) {
                  startPlaylistTimer(totalYouTubeDurationSec);
                }
                try { sessionStorage.setItem(sessionOpenedKey, "1"); } catch {}
              }
            }}
          />
          {round.status === "finished" && (
            <div ref={summaryTriggerRef}>
              {isVoteSummaryVisible ? (
                <RoundVoteSummary roundId={round._id} />
              ) : (
                <div className="my-8 min-h-[24rem]" />
              )}
            </div>
          )}
        </>
      )}

      <SubmissionCommentsPanel
        submission={activeSubmissionForPanel}
        roundStatus={round.status}
        onOpenChange={(isOpen) =>
          !isOpen && setActiveCommentsSubmissionId(null)
        }
        onPlaySong={handlePlaySongFromPanel}
      />

      <AlertDialog
        open={confirmationState.isOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setConfirmationState({
              isOpen: false,
              submissionId: null,
              delta: null,
            });
            setConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final Vote Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              This is your last vote for this round. Once you cast this vote,
              all your votes will be locked and cannot be changed. Are you sure
              you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="confirm-input" className="text-sm font-medium">
              To confirm, please type &quot;confirm&quot; below.
            </Label>
            <Input
              id="confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmationState({
                  isOpen: false,
                  submissionId: null,
                  delta: null,
                });
                setConfirmText("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmFinalVote}
              disabled={confirmText.toLowerCase() !== "confirm"}
            >
              Confirm Final Vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}