
"use client";

import { InlineBasketballIcon } from "@/components/icons/InlineBasketballIcon";
import { PlayerList } from "@/components/court-commander/PlayerList";
import { GameTimeline } from "@/components/court-commander/GameTimeline";
import { PlayingTimeSummary } from "@/components/court-commander/PlayingTimeSummary";
import { CourtCommanderControls } from "@/components/court-commander/CourtCommanderControls";
import { useCourtCommander } from "@/hooks/useCourtCommander";
import type { DraggedPlayerInfo, QuarterKey } from "@/lib/types";

export default function CourtCommanderPage() {
  const {
    currentPlan,
    gamePlans,
    players,
    schedule,
    addPlayer,
    editPlayer,
    deletePlayer,
    assignPlayerToPosition,
    unassignPlayerSegment,
    updatePlayerMinutesInSegment,
    getPlayerTotalTime,
    saveCurrentGamePlanAs,
    updateGamePlanName,
    loadGamePlan,
    createAndLoadNewGamePlan,
    deleteGamePlan,
  } = useCourtCommander();

  const handlePlayerDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    playerInfo: DraggedPlayerInfo
  ) => {
    e.dataTransfer.setData("application/json", JSON.stringify(playerInfo));
  };

  const handlePlayerDropOnTimeline = (
    targetQuarter: QuarterKey,
    targetPositionIndex: number, // Changed from targetSlotIndex
    draggedInfo: DraggedPlayerInfo
  ) => {
    assignPlayerToPosition(
      draggedInfo.playerId,
      targetQuarter,
      targetPositionIndex,
      draggedInfo // Pass the whole draggedInfo
    );
  };

  const handleDropInPlayerList = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData) return;
      const draggedInfo: DraggedPlayerInfo = JSON.parse(rawData);

      if (draggedInfo.sourceType === 'timeline' && draggedInfo.sourceQuarter && draggedInfo.sourcePositionIndex !== undefined && draggedInfo.sourceSegmentId) {
        unassignPlayerSegment(draggedInfo.sourceQuarter, draggedInfo.sourcePositionIndex, draggedInfo.sourceSegmentId);
      }
    } catch (error) {
      console.error("Failed to parse dragged data in player list:", error);
    }
  };

  const handlePrint = () => {
    window.print();
  };
  
  if (!currentPlan) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <InlineBasketballIcon className="h-16 w-16 text-primary mb-4 animate-bounce" />
        <p className="text-xl font-semibold text-muted-foreground">Loading Court Commander...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen p-2 sm:p-4 bg-background">
      <header className="mb-4 no-print">
        <div className="flex items-center space-x-2">
          <InlineBasketballIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold font-headline text-foreground">
            Court Commander
          </h1>
        </div>
        <p className="text-muted-foreground">
          Plan your basketball substitutions: {currentPlan.name}
        </p>
      </header>

      <CourtCommanderControls
        gamePlans={gamePlans}
        currentPlanName={currentPlan.name}
        currentPlanId={currentPlan.id}
        onSavePlanAs={saveCurrentGamePlanAs}
        onLoadPlan={loadGamePlan}
        onCreateNewPlan={createAndLoadNewGamePlan}
        onDeletePlan={deleteGamePlan}
        onRenamePlan={updateGamePlanName}
        onPrint={handlePrint}
      />

      <main className="flex-grow grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 mt-4 overflow-hidden printable-area">
        <div className="h-full overflow-hidden no-print md:block hidden">
           <PlayerList
            players={players}
            onAddPlayer={addPlayer}
            onEditPlayer={editPlayer}
            onDeletePlayer={deletePlayer}
            onPlayerDragStart={handlePlayerDragStart}
            onDropInPlayerList={handleDropInPlayerList}
          />
        </div>
         <div className="h-full overflow-hidden md:hidden no-print">
           <PlayerList
            players={players}
            onAddPlayer={addPlayer}
            onEditPlayer={editPlayer}
            onDeletePlayer={deletePlayer}
            onPlayerDragStart={handlePlayerDragStart}
            onDropInPlayerList={handleDropInPlayerList}
          />
        </div>


        <div className="h-full overflow-hidden">
          <GameTimeline
            schedule={schedule}
            allPlayers={players}
            onPlayerDrop={handlePlayerDropOnTimeline}
            onPlayerDragStart={handlePlayerDragStart}
            onUpdatePlayerMinutes={updatePlayerMinutesInSegment}
          />
        </div>
        
        <div className="h-full overflow-hidden no-print">
          <PlayingTimeSummary
            players={players}
            getPlayerTotalTime={getPlayerTotalTime}
          />
        </div>
      </main>
    </div>
  );
}
