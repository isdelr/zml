// convex/counters.ts
import { ShardedCounter } from "@convex-dev/sharded-counter";
import { components } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Counter for tracking the number of members in a league.
// The key will be the league's ID.
export const memberCounter = new ShardedCounter<Id<"leagues">>(
  components.shardedCounter,
  // We don't expect extreme write contention on a single league's member count,
  // so we can reduce the shards from the default of 16 to something lower.
  // Let's use 4 for this example.
  { defaultShards: 4 }
);

// You could also define other counters here, for example:
// export const unreadNotificationCounter = new ShardedCounter<Id<"users">>(...);