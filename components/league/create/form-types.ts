import type { Dispatch, SetStateAction } from "react";
import type { UseFormReturn } from "react-hook-form";
import type {
  CreateLeagueFormInput,
  CreateLeagueFormValues,
} from "@/lib/leagues/create-league-form";

export type CreateLeagueForm = UseFormReturn<
  CreateLeagueFormInput,
  unknown,
  CreateLeagueFormValues
>;

export type PreviewMapSetter = Dispatch<SetStateAction<Record<number, string>>>;
