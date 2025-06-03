
"use client";

import type { Player, QuarterSchedule, QuarterKey, DraggedPlayerInfo } from "@/lib/types";
import { QUARTERS } from "@/lib/types";
import { QuarterColumn } from "./QuarterColumn";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CalendarClock, Users } from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";

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
    // Removed h-full and flex-grow from Card, kept flex flex-col
    <Card className="shadow-xl flex flex-col"> 
      <CardHeader className="p-4 border-b">
        <div className="flex items-center space-x-2">
          <CalendarClock className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg font-headline">Game Timeline</CardTitle>
        </div>
      </CardHeader>
      <CardContent 
        className="p-4 flex-grow overflow-x-auto" // Kept flex-grow for vertical expansion within Card, overflow-x-auto for horizontal quarters
        onDragOver={handleDragOverTimeline}
        onDrop={handleDropOnTimelineBackground}
      >
        <div className="flex space-x-4 h-full min-w-max pb-2"> {/* h-full here might be fine if CardContent is flex-grow */}
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
      <CardFooter className="flex-col items-start p-4 border-t bg-muted/20">
        <div className="flex items-center space-x-2 mb-3">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-md font-semibold font-headline">Ending Lineup per Quarter</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
          {QUARTERS.map(qKey => (
            <div key={qKey} className="bg-card p-3 rounded-lg shadow">
              <h4 className="font-medium text-sm mb-2 text-center font-headline border-b pb-1">{quarterNames[qKey]}</h4>
              <ul className="space-y-1.5">
                {schedule[qKey].map((positionSegments, posIdx) => {
                  const lastSegment = positionSegments.length > 0 ? positionSegments[positionSegments.length - 1] : null;
                  const player = lastSegment ? allPlayers.find(p => p.id === lastSegment.playerId) : null;
                  return (
                    <li key={posIdx} className="text-xs flex items-center space-x-2 p-1 rounded-sm hover:bg-muted/50">
                      <span className="font-mono text-muted-foreground w-3 text-[10px]">P{posIdx + 1}</span>
                      {player ? (
                        <>
                          <PlayerAvatar name={player.name} />
                          <span className="truncate flex-grow">{player.name}</span>
                        </>
                      ) : (
                        <>
                          <PlayerAvatar name="" /> 
                          <span className="text-muted-foreground italic">Empty</span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}
