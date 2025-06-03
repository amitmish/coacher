
"use client";

import type { Player, QuarterSchedule, QuarterKey, DraggedPlayerInfo } from "@/lib/types";
import { QUARTERS } from "@/lib/types";
import { QuarterColumn } from "./QuarterColumn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Removed CardFooter
import { CalendarClock } from "lucide-react"; // Removed Users and PlayerAvatar (not used here anymore)

interface GameTimelineProps {
  schedule: QuarterSchedule;
  allPlayers: Player[];
  onPlayerDrop: (
    targetQuarter: QuarterKey,
    targetPositionIndex: number,
    draggedInfo: DraggedPlayerInfo
  ) => void;
  onPlayerDragStart: (e: React.DragEvent<HTMLDivElement>, playerInfo: DraggedPlayerInfo) => void;
  onUpdatePlayerMinutes: (quarterKey: QuarterKey, positionIndex: number, segmentId: string, minutes: number) => void;
}

export function GameTimeline({
  schedule,
  allPlayers,
  onPlayerDrop,
  onPlayerDragStart,
  onUpdatePlayerMinutes,
}: GameTimelineProps) {
  const quarterNames: Record<QuarterKey, string> = {
    Q1: "Quarter 1",
    Q2: "Quarter 2",
    Q3: "Quarter 3",
    Q4: "Quarter 4",
  };
  
  const handleDragOverTimeline = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = "move";
  };
  
  const handleDropOnTimelineBackground = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <Card className="shadow-xl flex flex-col"> 
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
              courtPositions={schedule[qKey]}
              allPlayers={allPlayers}
              onPlayerDrop={onPlayerDrop}
              onPlayerDragStartInSegment={onPlayerDragStart}
              onUpdatePlayerMinutes={onUpdatePlayerMinutes}
            />
          ))}
        </div>
      </CardContent>
      {/* Removed CardFooter and the "Ending Lineup per Quarter" section */}
    </Card>
  );
}
