import { dynamicImport } from "@/components/ui/dynamic-import";
import type { Metadata } from "next";

const CreateLeaguePage = dynamicImport(() =>
  import("@/components/CreateLeaguePage").then((mod) => ({
    default: mod.CreateLeaguePage,
  })),
);

export const metadata: Metadata = {
  title: "Create League",
  description:
    "Create a new music league, set up rounds, and invite your friends to compete.",
};

export default function CreateLeague() {
  return <CreateLeaguePage />;
}
