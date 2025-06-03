
"use client";

import type { Player, QuarterKey, OnCourtPlayerSlots, DraggedPlayerInfo } from "@/lib/types";
import { PLAYERS_ON_COURT, QUARTER_DURATION_MINUTES } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerCard } from "./PlayerCard";
import { useState } from "react";

interface QuarterColumnProps {
  quarterKey: QuarterKey;
  quarterName: string;
  playersOnCourt: OnCourtPlayerSlots;
  allPlayers: Player[];
  onPlayerDrop: (
    targetQuarter: QuarterKey,
    targetSlotIndex: number,
    draggedInfo: DraggedPlayerInfo
  ) => void;
  onPlayerDragStartInSlot: (e: React.DragEvent<HTMLDivElement>, playerInfo: DraggedPlayerInfo) => void;
  onUpdatePlayerMinutes: (quarterKey: QuarterKey, slotIndex: number, minutes: number) => void;
}

export function QuarterColumn({
  quarterKey,
  quarterName,
  playersOnCourt,
  allPlayers,
  onPlayerDrop,
  onPlayerDragStartInSlot,
  onUpdatePlayerMinutes,
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

  const handleMinutesChange = (value: number, slotIdx: number) => {
    const newMinutes = isNaN(value) ? 0 : Math.max(0, Math.min(value, QUARTER_DURATION_MINUTES));
    onUpdatePlayerMinutes(quarterKey, slotIdx, newMinutes);
  };

  return (
    <Card className="flex-1 min-w-[180px] md:min-w-[200px] shadow-lg flex flex-col h-full">
      <CardHeader className="p-3 border-b bg-muted/50">
        <CardTitle className="text-center text-md font-headline">{quarterName}</CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-2 flex-grow overflow-y-auto">
        {Array.from({ length: PLAYERS_ON_COURT }).map((_, slotIndex) => {
          const playerSlot = playersOnCourt[slotIndex];
          const playerId = playerSlot?.playerId; // Handle potentially undefined playerSlot if data is malformed
          const playerMinutes = playerSlot?.minutes ?? 0;
          const player = getPlayerById(playerId);
          
          return (
            <div
              key={slotIndex}
              onDragOver={(e) => handleDragOver(e, slotIndex)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, slotIndex)}
              className={`h-20 md:h-24 border-2 border-dashed rounded-md flex flex-col items-center justify-center transition-colors p-1
                ${draggedOverSlot === slotIndex ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-accent"}
                ${player ? "border-solid border-transparent bg-card" : ""}`}
            >
              {player ? (
                <>
                  <PlayerCard
                    player={player}
                    draggable
                    onDragStart={(e, info) => onPlayerDragStartInSlot(e, 
                      { ...info, playerId: player.id } // ensure playerId is correctly passed
                    )}
                    sourceQuarter={quarterKey}
                    sourceSlotIndex={slotIndex}
                    isSmall
                    className="w-full mb-1"
                  />
                  <div className="flex items-center space-x-1">
                    <Input
                      type="number"
                      value={playerMinutes}
                      onChange={(e) => handleMinutesChange(e.target.valueAsNumber, slotIndex)}
                      min="0"
                      max={QUARTER_DURATION_MINUTES}
                      className="w-16 h-7 text-xs p-1 text-center rounded-md shadow-sm bg-background"
                      aria-label={`Minutes for ${player.name} in ${quarterName} slot ${slotIndex + 1}`}
                    />
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </>
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
