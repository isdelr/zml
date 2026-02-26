import { z } from "zod";

import { isYouTubeLink } from "@/lib/youtube";

export const editSubmissionFormSchema = z
  .object({
    submissionType: z.enum(["file", "link"]),
    songTitle: z.string().min(1, { message: "Title is required." }),
    artist: z.string().min(1, { message: "Artist is required." }),
    comment: z.string().optional(),
    albumArtFile: z.instanceof(File).optional(),
    songFile: z.instanceof(File).optional(),
    songLink: z.string().optional(),
    duration: z.number().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.submissionType === "link") {
      if (!data.songLink || data.songLink.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A YouTube link is required.",
          path: ["songLink"],
        });
      } else if (!isYouTubeLink(data.songLink)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide a valid YouTube link.",
          path: ["songLink"],
        });
      }
    }
  });

export type EditSubmissionFormValues = z.infer<typeof editSubmissionFormSchema>;
