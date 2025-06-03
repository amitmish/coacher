"use client";

import type { Player, QuarterSchedule, QuarterKey, DraggedPlayerInfo } from "@/lib/types";
import { QUARTERS } from "@/lib/types";
import { QuarterColumn } from "./QuarterColumn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

interface GameTimelineProps {
  schedule: QuarterSchedule;
  allPlayers: Player[];
  onPlayerDrop: (
    targetQuarter: QuarterKey,
    targetSlotIndex: number,
    draggedInfo: DraggedPlayerInfo
  ) => void;
   onPlayerDragStart: (e: React.DragEvent<HTMLDivElement>, playerInfo: DraggedPlayerInfo) => void;
}

export function GameTimeline({
  schedule,
  allPlayers,
  onPlayerDrop,
  onPlayerDragStart
}: GameTimelineProps) {
  const quarterNames: Record<QuarterKey, string> = {
    Q1: "Quarter 1",
    Q2: "Quarter 2",
    Q3: "Quarter 3",
    Q4: "Quarter 4",
  };

  const handleDragOverTimeline = (e: React.DragEvent<HTMLDivElement>) => {
    // This allows dropping onto the timeline background to unassign, if implemented
    // For now, just prevent default if needed for broader drop zone logic
    // e.preventDefault(); 
  };
  
  const handleDropOnTimelineBackground = (e: React.DragEvent<HTMLDivElement>) => {
    // This could be a drop zone for unassigning a player (dragging from slot to timeline background)
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData) return;
      const draggedInfo: DraggedPlayerInfo = JSON.parse(rawData);
      
      // If player was dragged from a slot, unassign them
      if (draggedInfo.sourceQuarter && draggedInfo.sourceSlotIndex !== undefined) {
        // Call a specific unassign function if available, or handle here
        // For simplicity, this action is handled by dropping on player list now.
      }
    } catch (error) {
      console.error("Failed to parse dragged data on timeline background:", error);
    }
  };


  return (
    <Card className="flex-grow shadow-xl h-full flex flex-col">
      <CardHeader className="p-4 border-b">
        <div className="flex items-center space-x-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg font-headline">Game Timeline</CardTitle>
        </div>
      </CardHeader>
      <CardContent 
        className="p-4 flex-grow overflow-x-auto"
        onDragOver={handleDragOverTimeline}
        onDrop={handleDropOnTimelineBackground}
      >
        <div className="flex space-x-4 h-full min-w-max pb-2"> {/* min-w-max for horizontal scroll */}
          {QUARTERS.map((qKey) => (
            <QuarterColumn
              key={qKey}
              quarterKey={qKey}
              quarterName={quarterNames[qKey]}
              playersOnCourt={schedule[qKey]}
              allPlayers={allPlayers}
              onPlayerDrop={onPlayerDrop}
              onPlayerDragStartInSlot={onPlayerDragStart}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
