"use client";

import type { Player, DraggedPlayerInfo } from "@/lib/types";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, GripVertical } from "lucide-react";
import { PlayerCard } from "./PlayerCard";
import { PlayerFormDialog } from "./PlayerFormDialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PlayerListProps {
  players: Player[];
  onAddPlayer: (player: Player) => void;
  onEditPlayer: (player: Player) => void;
  onDeletePlayer: (playerId: string) => void;
  onPlayerDragStart: (e: React.DragEvent<HTMLDivElement>, playerInfo: DraggedPlayerInfo) => void;
  onDropInPlayerList: (e: React.DragEvent<HTMLDivElement>) => void; // To handle drops back to bench
}

export function PlayerList({
  players,
  onAddPlayer,
  onEditPlayer,
  onDeletePlayer,
  onPlayerDragStart,
  onDropInPlayerList
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

  return (
    <Card className="w-full md:w-80 shadow-xl h-full flex flex-col">
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
                  onDragStart={onPlayerDragStart}
                  onEdit={handleEditPlayer}
                  onDelete={onDeletePlayer}
                />
              ))}
            </div>
          )}
        </ScrollArea>
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
