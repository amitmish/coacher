
"use client";

import type { Player, DraggedPlayerInfo } from "@/lib/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users } from "lucide-react";
import { PlayerCard } from "./PlayerCard";
import { PlayerFormDialog } from "./PlayerFormDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip"; // Added import

interface PlayerListProps {
  players: Player[];
  onAddPlayer: (player: Player) => void;
  onEditPlayer: (player: Player) => void;
  onDeletePlayer: (playerId: string) => void;
  onPlayerDragStart: (e: React.DragEvent<HTMLDivElement>, playerInfo: DraggedPlayerInfo) => void;
  onDropInPlayerList: (e: React.DragEvent<HTMLDivElement>) => void;
  getPlayerTotalTime: (playerId: string) => number;
  onCourtPlayerIds: Set<string>; // New prop
}

export function PlayerList({
  players,
  onAddPlayer,
  onEditPlayer,
  onDeletePlayer,
  onPlayerDragStart,
  onDropInPlayerList,
  getPlayerTotalTime,
  onCourtPlayerIds, // New prop
}: PlayerListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setIsFormOpen(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setIsFormOpen(true);
  };

  const handleSubmitPlayerForm = (player: Player) => {
    if (editingPlayer) {
      onEditPlayer(player);
    } else {
      onAddPlayer(player);
    }
    setIsFormOpen(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handlePlayerCardDragStart = (e: React.DragEvent<HTMLDivElement>, player: Player) => {
    const dragInfo: DraggedPlayerInfo = {
      playerId: player.id,
      sourceType: 'list', 
    };
    onPlayerDragStart(e, dragInfo);
  };

  return (
    <Card className="w-full md:w-72 lg:w-80 md:flex-shrink-0 h-auto md:h-full flex flex-col shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg font-headline">Players</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={handleAddPlayer} className="text-primary hover:text-primary">
          <PlusCircle className="h-6 w-6" />
          <span className="sr-only">Add Player</span>
        </Button>
      </CardHeader>
      <CardContent 
        className="p-4 flex-grow overflow-hidden"
        onDragOver={handleDragOver}
        onDrop={onDropInPlayerList}
      >
        <TooltipProvider> {/* Added TooltipProvider wrapper */}
          <ScrollArea className="h-full">
            {players.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No players yet. Click the '+' to add one!
              </p>
            ) : (
              <div className="space-y-2">
                {players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    draggable
                    onDragStart={(e) => handlePlayerCardDragStart(e, player)}
                    onEdit={handleEditPlayer}
                    onDelete={onDeletePlayer}
                    totalPlayingTime={getPlayerTotalTime(player.id)}
                    isOnCourt={onCourtPlayerIds.has(player.id)} // Pass isOnCourt status
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TooltipProvider> {/* End TooltipProvider wrapper */}
      </CardContent>

      <PlayerFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmitPlayerForm}
        initialData={editingPlayer}
      />
    </Card>
  );
}
