import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import type { CreateLeagueForm } from "./form-types";

export function LeagueBasicInfoSection({ form }: { form: CreateLeagueForm }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        <Badge variant="secondary">Required</Badge>
      </div>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>League Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g., 90s Rock Anthems" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>League Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Describe what this league is about..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="isPublic"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border bg-card p-4">
            <div className="space-y-0.5">
              <FormLabel>Public League</FormLabel>
              <FormDescription>
                Allow anyone to discover and join this league in the explore page.
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}
