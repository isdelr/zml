import { genres } from "@/lib/genres";
import { Badge } from "@/components/ui/badge";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { CreateLeagueForm } from "./form-types";

export function GenreSelectorField({
  form,
  index,
}: {
  form: CreateLeagueForm;
  index: number;
}) {
  return (
    <FormField
      control={form.control}
      name={`rounds.${index}.genres`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Genres (Optional)</FormLabel>
          <FormDescription>Click on genres to select or unselect them.</FormDescription>
          <FormControl>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => (
                <Badge
                  key={genre}
                  variant={field.value?.includes(genre) ? "default" : "outline"}
                  onClick={() => {
                    const value = field.value ?? [];
                    const nextSelection = value.includes(genre)
                      ? value.filter((entry: string) => entry !== genre)
                      : [...value, genre];
                    field.onChange(nextSelection);
                  }}
                  className="cursor-pointer"
                >
                  {genre}
                </Badge>
              ))}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
