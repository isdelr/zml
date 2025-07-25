import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface FeatureShowcaseProps {
  title: string;
  description: string;
  imageUrl: string;
  reverse?: boolean;
  children: ReactNode;
}

export function FeatureShowcase({
  title,
  description,
  reverse = false,
  children,
}: FeatureShowcaseProps) {
  return (
    <section className="py-12 md:py-24">
      <div className="container mx-auto grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
        <div
          className={cn(
            "flex flex-col items-start space-y-4",
            reverse && "md:order-last"
          )}
        >
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h2>
          <p className="text-lg text-muted-foreground">{description}</p>
        </div>
        <div className="relative rounded-xl shadow-2xl shadow-primary/10">
          <div className="relative rounded-xl border bg-card/80 p-2 backdrop-blur-sm">
            <div className="flex items-center gap-2 p-2">
              <span className="size-3 rounded-full bg-muted"></span>
              <span className="size-3 rounded-full bg-muted"></span>
              <span className="size-3 rounded-full bg-muted"></span>
            </div>
            <div className="p-4">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}