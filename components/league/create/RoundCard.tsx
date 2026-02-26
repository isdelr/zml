import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlbumSettingsFields } from "@/components/league/create/AlbumSettingsFields";
import { GenreSelectorField } from "@/components/league/create/GenreSelectorField";
import { RoundImagePicker } from "@/components/league/create/RoundImagePicker";
import type { CreateLeagueForm, PreviewMapSetter } from "./form-types";

type RoundCardProps = {
  form: CreateLeagueForm;
  index: number;
  fieldsLength: number;
  onRemove: () => void;
  previewUrl?: string;
  setPreviews: PreviewMapSetter;
  isAlbumMode: boolean;
};

export function RoundCard({
  form,
  index,
  fieldsLength,
  onRemove,
  previewUrl,
  setPreviews,
  isAlbumMode,
}: RoundCardProps) {
  return (
    <Card className="relative">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Round {index + 1}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onRemove}
            disabled={fieldsLength <= 1}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col-reverse gap-6 md:flex-row">
          <div className="flex-1 space-y-4">
            <FormField
              control={form.control}
              name={`rounds.${index}.title`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Round Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Guilty Pleasures" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`rounds.${index}.description`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe the theme of this round." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`rounds.${index}.submissionsPerUser`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Songs per Participant</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={5} {...field} value={(field.value as number) || ""} />
                  </FormControl>
                  <FormDescription>
                    How many songs each participant can submit (1-5)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="w-full md:w-52">
            <RoundImagePicker
              form={form}
              index={index}
              previewUrl={previewUrl}
              setPreviews={setPreviews}
            />
          </div>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced" className="rounded-lg border px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Advanced Options</span>
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name={`rounds.${index}.submissionMode`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submission Mode</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a submission mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">Single song per submission</SelectItem>
                        <SelectItem value="multi">Multiple songs per round (shuffled)</SelectItem>
                        <SelectItem value="album">Album round (keep track order)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose how submissions should be grouped and presented.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`rounds.${index}.submissionInstructions`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submission Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Submit your favorite 3 tracks from the 90s..."
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Additional guidance shown to participants when submitting.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isAlbumMode && <AlbumSettingsFields form={form} index={index} />}

              <GenreSelectorField form={form} index={index} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
