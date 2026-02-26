import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CreateLeagueForm } from "./form-types";

export function AlbumSettingsFields({
  form,
  index,
}: {
  form: CreateLeagueForm;
  index: number;
}) {
  return (
    <div className="space-y-4 rounded-md border bg-muted/50 p-4">
      <h4 className="text-sm font-semibold text-muted-foreground">Album Round Settings</h4>
      <FormField
        control={form.control}
        name={`rounds.${index}.albumConfig.allowPartial`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
            <div className="space-y-0.5">
              <FormLabel>Allow partial albums</FormLabel>
              <FormDescription>
                Participants can submit only a selection of tracks.
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`rounds.${index}.albumConfig.requireReleaseYear`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-3">
            <div className="space-y-0.5">
              <FormLabel>Require album release year</FormLabel>
              <FormDescription>
                Ensure submissions include the album&apos;s release year.
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={`rounds.${index}.albumConfig.minTracks`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum Tracks</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  placeholder="Optional"
                  {...field}
                  value={(field.value as number) || ""}
                />
              </FormControl>
              <FormDescription>Leave blank to allow any length.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`rounds.${index}.albumConfig.maxTracks`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Maximum Tracks</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  placeholder="Optional"
                  {...field}
                  value={(field.value as number) || ""}
                />
              </FormControl>
              <FormDescription>Leave blank to allow any length.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
