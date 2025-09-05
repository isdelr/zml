import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Users, Vote } from "lucide-react";

const features = [
  {
    icon: <Users className="size-6" />,
    title: "Create or Join Leagues",
    description:
      "Start a private league with friends or join a public one to compete with music lovers worldwide.",
  },
  {
    icon: <Music className="size-6" />,
    title: "Submit Your Best Tracks",
    description:
      "Each round has a unique theme. Pick the perfect song from your library or YouTube.",
  },
  {
    icon: <Vote className="size-6" />,
    title: "Vote and Discover",
    description:
      "Anonymously vote on submissions, discover new music, and see who gets crowned the winner.",
  },
];

export function HomeFeatures() {
  return (
    <section
      id="features"
      className="container space-y-6 py-8 md:py-12 lg:py-24"
    >
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center pb-8">
        <h2 className="text-3xl font-bold leading-[1.1] md:text-5xl">
          Everything You Need to Compete
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          ZML is packed with features to make your music leagues fun, fair, and
          full of discovery.
        </p>
      </div>
      <div className="mx-auto grid justify-center gap-6 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="bg-card/50 text-center">
            <CardHeader className="flex flex-col items-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                {feature.icon}
              </div>
              <CardTitle>{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
