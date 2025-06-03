
"use client";

import type { Player, QuarterKey, OnCourtPositions, DraggedPlayerInfo, PlayerTimeSegment, CourtPositionSegments } from "@/lib/types";
import { PLAYERS_ON_COURT, QUARTER_DURATION_MINUTES } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerCard } from "./PlayerCard";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";


interface QuarterColumnProps {
  quarterKey: QuarterKey;
  quarterName: string;
  courtPositions: OnCourtPositions[QuarterKey]; // Array of 5 CourtPositionSegments arrays
  allPlayers: Player[];
  onPlayerDrop: (
    targetQuarter: QuarterKey,
    targetPositionIndex: number,
    draggedInfo: DraggedPlayerInfo
  ) => void;
  onPlayerDragStartInSegment: (e: React.DragEvent<HTMLDivElement>, playerInfo: DraggedPlayerInfo) => void;
  onUpdatePlayerMinutes: (quarterKey: QuarterKey, positionIndex: number, segmentId: string, minutes: number) => void;
}

export function QuarterColumn({
  quarterKey,
  quarterName,
  courtPositions,
  allPlayers,
  onPlayerDrop,
  onPlayerDragStartInSegment,
  onUpdatePlayerMinutes,
}: QuarterColumnProps) {
  const [draggedOverPosition, setDraggedOverPosition] = useState<number | null>(null);

  const getPlayerById = (id: string | null): Player | undefined => {
    return allPlayers.find(p => p.id === id);
  };

  const handleDragOverPosition = (e: React.DragEvent<HTMLDivElement>, positionIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDraggedOverPosition(positionIndex);
  };

  const handleDragLeavePosition = () => {
    setDraggedOverPosition(null);
  };

  const handleDropOnPosition = (e: React.DragEvent<HTMLDivElement>, positionIndex: number) => {
    e.preventDefault();
    setDraggedOverPosition(null);
    try {
      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData) {
        console.error("No data transferred on drop");
        return;
      }
      const draggedInfo: DraggedPlayerInfo = JSON.parse(rawData);
      onPlayerDrop(quarterKey, positionIndex, draggedInfo);
    } catch (error) {
      console.error("Failed to parse dragged data:", error);
    }
  };

  const handleMinutesChange = (value: number, positionIndex: number, segmentId: string) => {
    const newMinutes = isNaN(value) ? 0 : Math.max(0, Math.min(value, QUARTER_DURATION_MINUTES));
    onUpdatePlayerMinutes(quarterKey, positionIndex, segmentId, newMinutes);
  };

  return (
    <Card className="flex-1 min-w-[200px] md:min-w-[220px] shadow-lg flex flex-col h-full">
      <CardHeader className="p-3 border-b bg-muted/50">
        <CardTitle className="text-center text-md font-headline">{quarterName}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-y-auto"> {/* Changed p-3 to p-0 for ScrollArea */}
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3"> {/* Added p-3 here for internal padding */}
            {courtPositions.map((segmentsInPosition, positionIndex) => (
              <div
                key={positionIndex}
                onDragOver={(e) => handleDragOverPosition(e, positionIndex)}
                onDragLeave={handleDragLeavePosition}
                onDrop={(e) => handleDropOnPosition(e, positionIndex)}
                className={`min-h-[6rem] border-2 border-dashed rounded-md flex flex-col items-stretch justify-start transition-colors p-2 space-y-2
                  ${draggedOverPosition === positionIndex ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-accent"}
                  ${segmentsInPosition.length > 0 ? "border-solid border-transparent bg-card/50" : ""}`}
              >
                {segmentsInPosition.length > 0 ? (
                  segmentsInPosition.map((segment) => {
                    const player = getPlayerById(segment.playerId);
                    if (!player) return null; // Should not happen if data is clean

                    return (
                      <div key={segment.id} className="bg-card p-1 rounded shadow">
                        <PlayerCard
                          player={player}
                          draggable
                          onDragStart={(e, info) => onPlayerDragStartInSegment(e, info)}
                          sourceQuarter={quarterKey}
                          sourcePositionIndex={positionIndex}
                          sourceSegmentId={segment.id}
                          isSmall
                          className="w-full mb-1"
                        />
                        <div className="flex items-center space-x-1 justify-center">
                          <Input
                            type="number"
                            value={segment.minutes}
                            onChange={(e) => handleMinutesChange(e.target.valueAsNumber, positionIndex, segment.id)}
                            min="0"
                            max={QUARTER_DURATION_MINUTES}
                            className="w-16 h-7 text-xs p-1 text-center rounded-md shadow-sm bg-background"
                            aria-label={`Minutes for ${player.name} in ${quarterName} position ${positionIndex + 1} segment`}
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex-grow flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Drop Player Here</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
