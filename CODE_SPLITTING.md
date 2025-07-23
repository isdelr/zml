# Code Splitting Strategy

This document outlines the code splitting strategy implemented in the ZML application to improve performance and maintainability.

## Component Structure

The application has been restructured to follow these principles:

1. **Modular Components**: Large components have been broken down into smaller, focused components
2. **Dynamic Imports**: Components are loaded on-demand using Next.js dynamic imports
3. **Logical Grouping**: Components are organized by feature/domain in dedicated folders
4. **Reusable Layouts**: Common layouts are extracted to avoid repetition

## Dynamic Import Implementation

We use a custom utility function for dynamic imports that provides consistent loading states:

```tsx
 
import dynamic from "next/dynamic";
import { Skeleton } from "./skeleton";

export function dynamicImport(componentImportFn: () => Promise<any>, loadingComponent: React.ReactNode = <Skeleton className="h-full w-full min-h-[200px]" />) {
  return dynamic(componentImportFn, {
    loading: () => <>{loadingComponent}</>,
    ssr: false,
  });
}
```

## Component Organization

Components are organized into feature-specific directories:

- `/components/home/` - Home page components
- `/components/player/` - Music player components
- `/components/league/` - League page components
- `/components/round/` - Round detail components
- `/components/layout/` - Layout components

## Usage Examples

### Page Components

```tsx
import { dynamicImport } from "@/components/ui/dynamic-import";
import { PageLayout } from "@/components/layout/PageLayout";

 
const ExplorePage = dynamicImport(() => 
  import("@/components/ExplorePage").then(mod => ({ default: mod.ExplorePage }))
);

export default function ExploreLeaguesPage() {
  return (
    <PageLayout>
      <ExplorePage />
    </PageLayout>
  );
}
```

### Complex Components

Complex components have been split into smaller components:

#### MusicPlayer Components
- `PlayerControls.tsx` - Play/pause/skip controls
- `PlayerTrackInfo.tsx` - Track title and artist info
- `PlayerProgress.tsx` - Progress bar and waveform
- `PlayerActions.tsx` - Bookmark and queue actions

#### HomePage Components
- `HomeHeader.tsx` - Navigation and sign-in
- `HomeHero.tsx` - Main hero section
- `HomeFeatures.tsx` - Feature cards
- `HomeFooter.tsx` - Page footer

#### LeaguePage Components
- `LeagueHeader.tsx` - League header with search and actions
- `LeagueInfo.tsx` - League title and member info
- `LeagueTabs.tsx` - Tab navigation for rounds/standings
- `LeagueRounds.tsx` - Grid of round cards
- `LeagueJoinCard.tsx` - Card for joining a league
- `LeagueSettingsDialog.tsx` - Settings dialog with tabs

#### RoundDetail Components
- `RoundAdminControls.tsx` - Admin controls for round management
- `RoundHeader.tsx` - Round header with info and play button
- `SubmissionForm.tsx` - Form for submitting songs
- `SubmissionsList.tsx` - List of submissions with voting
- `SubmissionItem.tsx` - Individual submission item
- `SubmissionComments.tsx` - Comments section for submissions
- `EditRoundDialog.tsx` - Dialog for editing round details

## Benefits

1. **Improved Initial Load Time**: Only essential components are loaded initially
2. **Reduced Bundle Size**: Components are split into smaller chunks
3. **Better Maintainability**: Smaller components are easier to understand and modify
4. **Parallel Loading**: Components can load in parallel, improving perceived performance
5. **Code Reuse**: Smaller components can be reused across the application
6. **Improved Developer Experience**: Easier to navigate and understand the codebase
7. **Better Performance Metrics**: Improved Core Web Vitals scores

## Performance Optimizations

1. **Disabled SSR for Dynamic Components**: Components that are client-only have SSR disabled
2. **Lazy Loading**: Components are only loaded when needed
3. **Conditional Imports**: Components are only imported when their conditions are met
4. **Skeleton Loading States**: Consistent loading states for better user experience
5. **Chunking Strategy**: Related components are grouped in the same chunk
6. **Reduced Bundle Size**: Smaller initial JavaScript payload