# Frontend Modernization Phase 2 Update

Date: 2026-02-08

## Completed (This Iteration)

### 1) Submission domain extraction
- Added shared submission modules:
  - `lib/submission/constants.ts`
  - `lib/submission/metadata.ts`
  - `lib/submission/collection.ts`

- Refactored forms to use shared modules:
  - `components/SongSubmissionForm.tsx`
  - `components/EditSubmissionForm.tsx`
  - `components/MultiSongSubmissionForm.tsx`
  - `components/AlbumSubmissionForm.tsx`

Changes include:
- Centralized file-size constants.
- Centralized audio metadata parsing (`parseAudioFileMetadata`) including optional cover art extraction.
- Centralized collection id generation for multi/album flows.
- Replaced repeated YouTube URL checks with shared helper.

### 2) RoundDetail decomposition (logic extraction)
- Added `lib/rounds/submission-order.ts`.
- `components/RoundDetail.tsx` now delegates deterministic round ordering/shuffling to shared utility.
- Added shared YouTube helper usage in `RoundDetail`.

### 3) MusicPlayer decomposition (logic extraction)
- Added `lib/music/presigned-url.ts`.
- `components/MusicPlayer.tsx` now uses shared presigned URL expiry/refresh-delay logic.
- Switched queue playlist URL construction/extraction to shared YouTube utilities.

### 4) Shared YouTube utility module
- Added `lib/youtube.ts`:
  - `isYouTubeLink`
  - `extractYouTubeVideoId`
  - `buildYouTubeWatchVideosUrl`

### 5) CreateLeaguePage schema/default extraction
- Added `lib/leagues/create-league-form.ts`:
  - `createLeagueFormSchema`
  - `defaultCreateLeagueFormValues`
  - `createDefaultRound`
  - `CreateLeagueFormValues`
- Updated `components/CreateLeaguePage.tsx` to consume this shared module instead of defining schema/defaults inline.
- Kept strict RHF typing by explicitly modeling Zod input/output for coerced fields.

### 6) LeagueStats component extraction
- Added `components/league/stats/AwardCards.tsx` containing:
  - `UserRow`
  - `SongRow`
  - `RoundRow`
  - `Podium`
- Updated `components/LeagueStats.tsx` to import these UI blocks instead of hosting all award/podium internals inline.
- Result: `LeagueStats` now focuses on data wiring and high-level layout.

### 7) CreateLeaguePage section decomposition
- Added:
  - `components/league/create/LeagueBasicInfoSection.tsx`
  - `components/league/create/LeagueRoundsSection.tsx`
  - `components/league/create/LeagueRulesAccordion.tsx`
- Updated `components/CreateLeaguePage.tsx` to compose these sections instead of embedding all form JSX in one file.
- Added `CreateLeagueFormInput` export in `lib/leagues/create-league-form.ts` to keep RHF input/output typing explicit across extracted components.

### 8) LeagueStats list/chart decomposition
- Added:
  - `components/league/stats/TopSongsList.tsx`
  - `components/league/stats/AllRoundsGrid.tsx`
  - `components/league/stats/GenreBreakdownChart.tsx`
- Updated `components/LeagueStats.tsx` to delegate top-10 songs, rounds summary, and genre chart rendering to these presentational modules.
- Result: `LeagueStats` is further reduced and now primarily wires data + section ordering.

### 9) RoundDetail YouTube flow hook extraction
- Added `hooks/useRoundYouTubePlaylist.ts` to centralize:
  - playlist session keys (`opened`, `endAt`, `duration`, `done`)
  - timer lifecycle and resume behavior
  - batch completion mutation + local completion callback
  - auto-open-once behavior for voting phase
- Updated `components/RoundDetail.tsx` to consume this hook and removed the inline timer/session logic block.
- Also replaced React-compiler-sensitive memoized YouTube data derivation with pure helper computation.

### 10) MusicPlayer utility extraction
- Added `lib/music/comments.ts` with `extractTimestampedWaveformComments`.
- Added `lib/music/youtube-queue.ts` with:
  - `getQueueYouTubeVideoIds`
  - `markRoundYouTubePlaylistOpened`
- Updated `components/MusicPlayer.tsx` to use these shared utilities for waveform-comment parsing and queue playlist opening.

### 11) RoundDetail vote/finalization hook extraction
- Added `hooks/useRoundVoting.ts` to centralize:
  - optimistic vote updates for `api.votes.castVote`
  - final-vote confirmation dialog state/text management
  - vote click handling + finalization detection
  - derived vote summary fields (remaining votes, effective limits, custom-limit flag)
- Updated `components/RoundDetail.tsx` to consume `useRoundVoting` and removed duplicated inline vote logic.

### 12) MusicPlayer listen-enforcement utility extraction
- Added `lib/music/listen-enforcement.ts` with:
  - `hasCompletedListenRequirement`
  - `clampSeekTargetToAllowedProgress`
  - `getRequiredListenTimeSeconds`
  - `shouldMarkListenCompleted`
- Updated `components/MusicPlayer.tsx` to use these helpers in:
  - seek interception from global seek state
  - direct slider seek handler
  - timeupdate completion checks

### 13) MusicPlayer lifecycle hook extraction
- Added `hooks/useSubmissionWaveform.ts` to encapsulate:
  - cached waveform fetch path
  - waveform generation via storage proxy + Web Audio
  - waveform persistence via `storeWaveform`
  - presigned URL retry fallback for waveform fetch failures
- Added `hooks/useListeningPresence.ts` to encapsulate track presence lifecycle updates.
- Updated `components/MusicPlayer.tsx` to consume these hooks and remove inline waveform/presence effect blocks.

### 14) MusicPlayer playback-sync hook extraction
- Added `hooks/useAudioPlaybackSync.ts` to encapsulate:
  - expiring file URL refresh scheduling
  - pending seek/play state capture + restore after URL refresh
  - file playback sync and external-link open behavior
  - centralized audio-error refresh recovery
- Updated `components/MusicPlayer.tsx` to consume this hook and remove the large inline playback effect.

### 15) RoundDetail submitter-summary helper extraction
- Added `lib/rounds/submitter-summary.ts` with `getRoundSubmitterSummary`.
- Updated `components/RoundDetail.tsx` to use this helper for completed/missing submitter calculations.

### 16) LeagueRoundsSection leaf decomposition
- Added reusable leaf components:
  - `components/league/create/RoundImagePicker.tsx`
  - `components/league/create/AlbumSettingsFields.tsx`
  - `components/league/create/GenreSelectorField.tsx`
- Added shared form typing module:
  - `components/league/create/form-types.ts`
- Updated `components/league/create/LeagueRoundsSection.tsx` to compose these leaf components instead of embedding all image/album/genre logic inline.

### 17) LeagueStats export hook extraction
- Added `hooks/useLeagueStatsExport.ts` to encapsulate:
  - export container ref
  - export loading state
  - PNG capture/download flow via `toPng`
- Updated `components/LeagueStats.tsx` to consume this hook and remove inline export state/effect logic.

### 18) MusicPlayer listen-progress sync hook extraction
- Added `hooks/useListenProgressSync.ts` to encapsulate:
  - periodic listen-progress persistence interval
  - playback guards (`enabled`, `isPlaying`, `submissionId`, audio time > 0)
- Updated `components/MusicPlayer.tsx` to consume this hook and remove inline DB-sync interval effect.

### 19) LeagueRoundsSection round-card extraction
- Added `components/league/create/RoundCard.tsx` to encapsulate per-round card structure.
- Updated `components/league/create/LeagueRoundsSection.tsx` to focus on field-array orchestration and delegate per-item rendering to `RoundCard`.

## Tests Added for Extracted Logic
- `tests/unit/youtube.test.ts`
- `tests/unit/round-submission-order.test.ts`
- `tests/unit/presigned-url.test.ts`
- `tests/unit/music-comments.test.ts`
- `tests/unit/youtube-queue.test.ts`
- `tests/unit/listen-enforcement.test.ts`
- `tests/unit/round-submitter-summary.test.ts`

## Validation
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run test:unit` passed (24 tests)
- `npm run test:e2e -- --project=chromium --grep "homepage renders with expected title"` passed

## Remaining Phase 2 candidates
- Optional: split `RoundCard` further if needed (basic fields vs advanced accordion), though current size/readability is already substantially improved.
