"use client";

import type { Player, QuarterKey, OnCourtPlayers, DraggedPlayerInfo } from "@/lib/types";
import { PLAYERS_ON_COURT } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlayerCard } from "./PlayerCard";
import { useState } from "react"; // For drop target highlighting

interface QuarterColumnProps {
  quarterKey: QuarterKey;
  quarterName: string;
  playersOnCourt: OnCourtPlayers;
  allPlayers: Player[];
  onPlayerDrop: (
    targetQuarter: QuarterKey,
    targetSlotIndex: number,
    draggedInfo: DraggedPlayerInfo
  ) => void;
  onPlayerDragStartInSlot: (e: React.DragEvent<HTMLDivElement>, playerInfo: DraggedPlayerInfo) => void;
}

export function QuarterColumn({
  quarterKey,
  quarterName,
  playersOnCourt,
  allPlayers,
  onPlayerDrop,
  onPlayerDragStartInSlot,
}: QuarterColumnProps) {
  const [draggedOverSlot, setDraggedOverSlot] = useState<number | null>(null);

  const getPlayerById = (id: string | null): Player | undefined => {
    return allPlayers.find(p => p.id === id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDraggedOverSlot(slotIndex);
  };

  const handleDragLeave = () => {
    setDraggedOverSlot(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault();
    setDraggedOverSlot(null);
    try {
      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData) {
        console.error("No data transferred on drop");
        return;
      }
      const draggedInfo: DraggedPlayerInfo = JSON.parse(rawData);
      onPlayerDrop(quarterKey, slotIndex, draggedInfo);
    } catch (error) {
      console.error("Failed to parse dragged data:", error);
    }
  };

  return (
    <Card className="flex-1 min-w-[180px] md:min-w-[200px] shadow-lg flex flex-col h-full">
      <CardHeader className="p-3 border-b bg-muted/50">
        <CardTitle className="text-center text-md font-headline">{quarterName}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2 flex-grow overflow-y-auto">
        {Array.from({ length: PLAYERS_ON_COURT }).map((_, slotIndex) => {
          const playerId = playersOnCourt[slotIndex];
          const player = getPlayerById(playerId);
          return (
            <div
              key={slotIndex}
              onDragOver={(e) => handleDragOver(e, slotIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, slotIndex)}
              className={`h-16 md:h-[76px] border-2 border-dashed rounded-md flex items-center justify-center transition-colors
                ${draggedOverSlot === slotIndex ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-accent"}
                ${player ? "p-0 border-solid border-transparent" : "p-2"}`} // No padding if player card is there
            >
              {player ? (
                <PlayerCard
                  player={player}
                  draggable
                  onDragStart={(e, info) => onPlayerDragStartInSlot(e, info)}
                  sourceQuarter={quarterKey}
                  sourceSlotIndex={slotIndex}
                  isSmall
                  className="w-full h-full"
                />
              ) : (
                <span className="text-xs text-muted-foreground">Drop Player Here</span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
