"use client";

import { Plus, Search, Trophy, Users } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { AddLeagueDialog } from "./AddLeagueDialog";

// Mock data for public leagues
const publicLeagues = [
  {
    id: 1,
    name: "Global Groove",
    description: "Discover music from every corner of the world. All genres welcome!",
    members: 128,
    theme: "World Music",
    art: "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
  },
  {
    id: 2,
    name: "Cinema Sonics",
    description: "For the love of soundtracks and scores. From blockbuster hits to indie gems.",
    members: 74,
    theme: "Movie Soundtracks",
    art: "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
  },
  {
    id: 3,
    name: "90s Nostalgia Trip",
    description: "Relive the decade of grunge, boy bands, and everything in between.",
    members: 256,
    theme: "90s Music",
    art: "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
  },
  {
    id: 4,
    name: "Underground Uncovered",
    description: "A league dedicated to unearthing hidden talent and unsigned artists.",
    members: 52,
    theme: "Indie & Unsigned",
    art: "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
  },
  {
    id: 5,
    name: "Classical Compositions",
    description: "From Baroque to Modern, a league for lovers of classical music.",
    members: 88,
    theme: "Classical",
    art: "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
  },
  {
    id: 6,
    name: "Jazz & Blues Jam",
    description: "Improvise, swing, and feel the blues. All subgenres welcome.",
    members: 110,
    theme: "Jazz & Blues",
    art: "https://i.ytimg.com/vi/J7tp_0lFI0I/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDnX9OH1KITaxV876Nn-gONVGbK_w",
  },
];

const filterTabs = ["All", "Popular", "Newest", "Rock", "Hip-Hop", "Electronic"];

export function ExplorePage() {
  const [activeTab, setActiveTab] = useState("All");

  return (
    <div className="flex-1 overflow-y-auto bg-background text-foreground">
      <div className="p-8">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-4xl font-bold">Explore Public Leagues</h1>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for a league..."
              className="h-10 w-full rounded-md border-none bg-secondary pl-10 pr-4 text-sm"
            />
          </div>
          <AddLeagueDialog>
            <Button>
              <Plus className="mr-2 size-4" />
              Create League
            </Button>
          </AddLeagueDialog>
        </header>

        {/* Filter Tabs */}
        <div className="mb-8 flex items-center gap-2 border-b border-border">
          {filterTabs.map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              className={`rounded-none border-b-2 font-semibold hover:text-foreground ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>

        {/* League Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {publicLeagues.map((league) => (
            <Card
              key={league.id}
              className="group bg-card transition-colors hover:bg-accent"
            >
              <CardHeader>
                <div className="relative mb-4">
                  <Image
                    src={league.art}
                    alt={league.name}
                    width={250}
                    height={250}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <Button className="absolute bottom-2 right-2 h-10 w-10 rounded-full bg-primary text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    <Trophy className="size-5 fill-primary-foreground" />
                  </Button>
                </div>
                <CardTitle>{league.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {league.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  <span>{league.members} members</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}