
"use client";

import type { Player, QuarterKey, OnCourtPositions, DraggedPlayerInfo, PlayerTimeSegment, CourtPositionSegments } from "@/lib/types";
import { PLAYERS_ON_COURT, QUARTER_DURATION_MINUTES } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlayerCard } from "./PlayerCard";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";


interface QuarterColumnProps {
  quarterKey: QuarterKey;
  quarterName: string;
  courtPositions: OnCourtPositions[QuarterKey]; 
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

  return (
    <Card className="flex-1 min-w-[180px] md:min-w-[200px] shadow-lg flex flex-col h-full">
      <CardHeader className="p-3 border-b bg-muted/50">
        <CardTitle className="text-center text-md font-headline">{quarterName}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-y-auto">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            {courtPositions.map((segmentsInPosition, positionIndex) => {
              const totalMinutesInPosition = segmentsInPosition.reduce((sum, seg) => sum + seg.minutes, 0);
              
              return (
                <div
                  key={positionIndex}
                  onDragOver={(e) => handleDragOverPosition(e, positionIndex)}
                  onDragLeave={handleDragLeavePosition}
                  onDrop={(e) => handleDropOnPosition(e, positionIndex)}
                  className={`min-h-[5rem] border-2 border-dashed rounded-md flex flex-col items-stretch justify-start transition-colors p-1.5 space-y-1.5
                    ${draggedOverPosition === positionIndex ? "border-primary bg-primary/10" : "border-muted-foreground/30 hover:border-accent"}
                    ${segmentsInPosition.length > 0 ? "border-solid border-transparent bg-card/50" : ""}`}
                >
                  {segmentsInPosition.length > 0 ? (
                    segmentsInPosition.map((segment) => {
                      const player = getPlayerById(segment.playerId);
                      if (!player) return null; 

                      return (
                        <div key={segment.id} className="bg-transparent rounded">
                          <PlayerCard
                            player={player}
                            draggable
                            onDragStart={(e, info) => onPlayerDragStartInSegment(e, info)}
                            sourceQuarter={quarterKey}
                            sourcePositionIndex={positionIndex}
                            sourceSegmentId={segment.id}
                            minutes={segment.minutes}
                            onMinutesChange={(newMinutes) => 
                              onUpdatePlayerMinutes(quarterKey, positionIndex, segment.id, newMinutes)
                            }
                            isSmall
                            className="w-full"
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-grow flex items-center justify-center min-h-[3rem]">
                      <span className="text-xs text-muted-foreground">Drop Player</span>
                    </div>
                  )}
                   <div className={cn(
                      "text-xs text-center pt-1 font-medium",
                      totalMinutesInPosition > QUARTER_DURATION_MINUTES ? "text-destructive" : "text-muted-foreground",
                      segmentsInPosition.length === 0 && "opacity-0" // Hide if no players in position
                    )}>
                      {totalMinutesInPosition} / {QUARTER_DURATION_MINUTES} min
                    </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
