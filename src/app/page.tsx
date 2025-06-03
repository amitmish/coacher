
"use client";

import { InlineBasketballIcon } from "@/components/icons/InlineBasketballIcon";
import { PlayerList } from "@/components/court-commander/PlayerList";
import { GameTimeline } from "@/components/court-commander/GameTimeline";
import { CourtCommanderControls } from "@/components/court-commander/CourtCommanderControls";
import { useCourtCommander } from "@/hooks/useCourtCommander";
import type { DraggedPlayerInfo, QuarterKey } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CourtCommanderPage() {
  const {
    currentPlan,
    isLoading,
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
    getCurrentlyOnCourtPlayerIds, // New function from hook
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
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePlayerDropOnTimeline = (
    targetQuarter: QuarterKey,
    targetPositionIndex: number,
    draggedInfo: DraggedPlayerInfo
  ) => {
    assignPlayerToPosition(
      draggedInfo.playerId,
      targetQuarter,
      targetPositionIndex,
      draggedInfo 
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

  const onCourtPlayerIds = currentPlan ? getCurrentlyOnCourtPlayerIds() : new Set<string>();

  if (isLoading || !currentPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <InlineBasketballIcon className="h-16 w-16 text-primary mb-4 animate-bounce" />
        <p className="text-xl font-semibold text-muted-foreground">Loading Court Commander...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-2 sm:p-4 bg-background text-foreground"> 
      <header className="mb-2 sm:mb-4 no-print">
        <div className="flex items-center space-x-2">
          <InlineBasketballIcon className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
          <h1 className="text-2xl sm:text-3xl font-bold font-headline">
            Court Commander
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Plan: <span className="font-semibold text-foreground/90">{currentPlan.name}</span>
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

      {/* Mobile Tabbed View */}
      <div className="md:hidden flex-grow mt-3 sm:mt-4 overflow-hidden printable-area">
        <Tabs defaultValue="players" className="w-full h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 sticky top-0 z-10 bg-background/95 backdrop-blur-sm shadow-sm">
            <TabsTrigger value="players">Players ({players.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
          <TabsContent value="players" className="flex-grow overflow-auto pt-2 pb-12"> 
            <PlayerList
              players={players}
              onAddPlayer={addPlayer}
              onEditPlayer={editPlayer}
              onDeletePlayer={deletePlayer}
              onPlayerDragStart={handlePlayerDragStart}
              onDropInPlayerList={handleDropInPlayerList}
              getPlayerTotalTime={getPlayerTotalTime}
              onCourtPlayerIds={onCourtPlayerIds} // Pass the set of on-court player IDs
            />
          </TabsContent>
          <TabsContent value="timeline" className="flex-grow overflow-auto pt-2 pb-12"> 
            <GameTimeline
              schedule={schedule}
              allPlayers={players}
              onPlayerDrop={handlePlayerDropOnTimeline}
              onPlayerDragStart={handlePlayerDragStart}
              onUpdatePlayerMinutes={updatePlayerMinutesInSegment}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop Side-by-Side View */}
      <main className="hidden md:flex flex-grow gap-3 sm:gap-4 mt-3 sm:mt-4 printable-area">
        <div className="md:w-72 lg:w-80 md:flex-shrink-0 h-full"> 
          <PlayerList
            players={players}
            onAddPlayer={addPlayer}
            onEditPlayer={editPlayer}
            onDeletePlayer={deletePlayer}
            onPlayerDragStart={handlePlayerDragStart}
            onDropInPlayerList={handleDropInPlayerList}
            getPlayerTotalTime={getPlayerTotalTime}
            onCourtPlayerIds={onCourtPlayerIds} // Pass the set of on-court player IDs
          />
        </div>
        <div className="flex-grow"> 
          <GameTimeline
            schedule={schedule}
            allPlayers={players}
            onPlayerDrop={handlePlayerDropOnTimeline}
            onPlayerDragStart={handlePlayerDragStart}
            onUpdatePlayerMinutes={updatePlayerMinutesInSegment}
          />
        </div>
      </main>
    </div>
  );
}
