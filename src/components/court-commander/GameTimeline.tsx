
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
  onUpdatePlayerMinutes: (quarterKey: QuarterKey, slotIndex: number, minutes: number) => void; // Added this
}

export function GameTimeline({
  schedule,
  allPlayers,
  onPlayerDrop,
  onPlayerDragStart,
  onUpdatePlayerMinutes, // Added this
}: GameTimelineProps) {
  const quarterNames: Record<QuarterKey, string> = {
    Q1: "Quarter 1",
    Q2: "Quarter 2",
    Q3: "Quarter 3",
    Q4: "Quarter 4",
  };
  
  const handleDragOverTimeline = (e: React.DragEvent<HTMLDivElement>) => {
    // e.preventDefault(); 
  };
  
  const handleDropOnTimelineBackground = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData) return;
      // const draggedInfo: DraggedPlayerInfo = JSON.parse(rawData);
      // Handle unassign if needed here
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
        <div className="flex space-x-4 h-full min-w-max pb-2">
          {QUARTERS.map((qKey) => (
            <QuarterColumn
              key={qKey}
              quarterKey={qKey}
              quarterName={quarterNames[qKey]}
              playersOnCourt={schedule[qKey]}
              allPlayers={allPlayers}
              onPlayerDrop={onPlayerDrop}
              onPlayerDragStartInSlot={onPlayerDragStart}
              onUpdatePlayerMinutes={onUpdatePlayerMinutes} // Pass down
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
