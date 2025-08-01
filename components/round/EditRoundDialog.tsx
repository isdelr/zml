"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const roundEditSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters."),
});

interface EditRoundDialogProps {
  round: Record<string, unknown>;
  onClose: () => void;
}

export function EditRoundDialog({
  round,
  onClose,
}: EditRoundDialogProps) {
  const updateRound = useMutation(api.rounds.updateRound);
  const form = useForm<z.infer<typeof roundEditSchema>>({
    resolver: zodResolver(roundEditSchema),
    defaultValues: {
      title: round.title as string,
      description: round.description as string,
    },
  });
  
  async function onSubmit(values: z.infer<typeof roundEditSchema>) {
    toast.promise(updateRound({ roundId: round._id, ...values }), {
      loading: "Updating round...",
      success: (msg) => {
        onClose();
        return msg;
      },
      error: (err) => err.data?.message || "Failed to update round.",
    });
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Round Title</FormLabel>
              <FormControl>
                <Input {...field} />
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
              <FormLabel>Round Description</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}