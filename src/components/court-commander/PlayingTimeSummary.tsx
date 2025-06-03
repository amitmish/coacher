"use client";

import type { Player } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PlayerAvatar } from "./PlayerAvatar";
import { Clock } from "lucide-react";

interface PlayingTimeSummaryProps {
  players: Player[];
  getPlayerTotalTime: (playerId: string) => number;
}

export function PlayingTimeSummary({
  players,
  getPlayerTotalTime,
}: PlayingTimeSummaryProps) {
  const playersWithTime = players
    .map(player => ({
      ...player,
      totalTime: getPlayerTotalTime(player.id),
    }))
    .sort((a, b) => b.totalTime - a.totalTime); // Sort by time, descending

  return (
    <Card className="w-full md:w-80 shadow-xl h-full flex flex-col">
      <CardHeader className="flex flex-row items-center space-x-2 p-4 border-b">
        <Clock className="h-6 w-6 text-primary" />
        <CardTitle className="text-lg font-headline">Playing Time</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <ScrollArea className="h-full">
          {playersWithTime.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-4">
              No players or no time scheduled yet.
            </p>
          ) : (
            <ul className="divide-y">
              {playersWithTime.map((player) => (
                <li key={player.id} className="p-3 flex items-center justify-between hover:bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <PlayerAvatar name={player.name} />
                    <div>
                      <p className="text-sm font-medium">{player.name}</p>
                      {player.jerseyNumber && (
                        <p className="text-xs text-muted-foreground">#{player.jerseyNumber}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {player.totalTime} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
