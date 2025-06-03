
"use client";
import type { Player, DraggedPlayerInfo, QuarterKey } from "@/lib/types";
import { QUARTER_DURATION_MINUTES } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GripVertical, Edit3, Trash2, Shirt } from "lucide-react";
import { PlayerAvatar } from "./PlayerAvatar";

interface PlayerCardProps {
  player: Player;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, playerInfo: DraggedPlayerInfo) => void;
  // Props for when card is on timeline (isSmall = true)
  sourceQuarter?: QuarterKey;
  sourcePositionIndex?: number;
  sourceSegmentId?: string;
  minutes?: number; // For displaying/editing minutes in small card
  onMinutesChange?: (minutes: number) => void; // Callback to update minutes

  onEdit?: (player: Player) => void;
  onDelete?: (playerId: string) => void;
  isSmall?: boolean;
  className?: string;
}

export function PlayerCard({
  player,
  draggable = false,
  onDragStart,
  sourceQuarter,
  sourcePositionIndex,
  sourceSegmentId,
  minutes,
  onMinutesChange,
  onEdit,
  onDelete,
  isSmall = false,
  className = "",
}: PlayerCardProps) {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (onDragStart) {
      const isTimelineSource = sourceQuarter !== undefined && sourcePositionIndex !== undefined && sourceSegmentId !== undefined;
      
      const dragInfo: DraggedPlayerInfo = {
        playerId: player.id,
        sourceType: isTimelineSource ? 'timeline' : 'list',
      };

      if (isTimelineSource) {
        dragInfo.sourceQuarter = sourceQuarter;
        dragInfo.sourcePositionIndex = sourcePositionIndex;
        dragInfo.sourceSegmentId = sourceSegmentId;
      }
      
      onDragStart(e, dragInfo);
      e.dataTransfer.effectAllowed = "move";
    }
  };

  const handleMinutesInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onMinutesChange) {
      const newMinutes = e.target.valueAsNumber;
      onMinutesChange(isNaN(newMinutes) ? 0 : newMinutes);
    }
  };

  if (isSmall) { // Typically for timeline segments
    return (
      <div
        draggable={draggable}
        onDragStart={handleDragStart}
        className={`p-1.5 rounded-md shadow-md bg-card text-card-foreground cursor-grab flex flex-col space-y-1 text-xs ${className}`}
        title={`${player.name} ${player.jerseyNumber ? `(#${player.jerseyNumber})` : ''} ${player.position ? `- ${player.position}` : ''}`}
      >
        <div className="flex items-center space-x-1.5">
          {draggable && <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <PlayerAvatar name={player.name} />
          <div className="flex-grow truncate">
            <p className="font-medium truncate text-xs">{player.name}</p>
            {player.jerseyNumber && <p className="text-muted-foreground truncate text-[10px]">#{player.jerseyNumber}</p>}
          </div>
        </div>
        {onMinutesChange !== undefined && minutes !== undefined && (
          <div className="flex items-center space-x-1 justify-center pt-0.5">
            <Input
              type="number"
              value={minutes}
              onChange={handleMinutesInputChange}
              min="0"
              max={QUARTER_DURATION_MINUTES}
              className="w-12 h-6 text-xs p-1 text-center rounded-sm shadow-sm bg-background"
              aria-label={`Minutes for ${player.name}`}
              onClick={(e) => e.stopPropagation()} // Prevent drag start on input click
              onMouseDown={(e) => e.stopPropagation()} // Also good for preventing drag issues
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        )}
      </div>
    );
  }

  // Larger card, typically for PlayerList
  return (
    <Card
      draggable={draggable}
      onDragStart={handleDragStart}
      className={`mb-2 shadow-lg hover:shadow-xl transition-shadow ${draggable ? "cursor-grab" : ""} ${className}`}
    >
      <CardHeader className="p-3 flex flex-row items-center justify-between space-x-2">
        <div className="flex items-center space-x-2 flex-grow min-w-0">
          {draggable && <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />}
          <PlayerAvatar name={player.name} />
          <div className="flex-grow min-w-0">
            <CardTitle className="text-base font-medium truncate font-headline">{player.name}</CardTitle>
          </div>
        </div>
        <div className="flex space-x-1 shrink-0">
          {onEdit && (
            <Button variant="ghost" size="icon" onClick={() => onEdit(player)} className="h-7 w-7">
              <Edit3 size={16} />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="icon" onClick={() => onDelete(player.id)} className="h-7 w-7 text-destructive hover:text-destructive">
              <Trash2 size={16} />
            </Button>
          )}
        </div>
      </CardHeader>
      {(player.jerseyNumber || player.position) && (
        <CardContent className="p-3 pt-0 text-sm">
          {player.jerseyNumber && (
            <div className="flex items-center text-muted-foreground">
              <Shirt size={14} className="mr-1.5" /> Jersey: {player.jerseyNumber}
            </div>
          )}
          {player.position && (
            <p className="text-muted-foreground mt-0.5">Position: {player.position}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
