
"use client";

import type { Player, GamePlan, QuarterSchedule, QuarterKey, OnCourtPositions, PlayerTimeSegment, DraggedPlayerInfo, CourtPositionSegments } from "@/lib/types";
import { QUARTERS, PLAYERS_ON_COURT, QUARTER_DURATION_MINUTES } from "@/lib/types";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY_PLANS = "courtCommanderGamePlans";
const LOCAL_STORAGE_KEY_CURRENT_PLAN_ID = "courtCommanderCurrentPlanId";

const createEmptySchedule = (): QuarterSchedule => {
  const emptyPosition = (): CourtPositionSegments => [];
  return {
    Q1: Array(PLAYERS_ON_COURT).fill(null).map(emptyPosition) as OnCourtPositions,
    Q2: Array(PLAYERS_ON_COURT).fill(null).map(emptyPosition) as OnCourtPositions,
    Q3: Array(PLAYERS_ON_COURT).fill(null).map(emptyPosition) as OnCourtPositions,
    Q4: Array(PLAYERS_ON_COURT).fill(null).map(emptyPosition) as OnCourtPositions,
  };
};

const createNewGamePlan = (name: string = "New Game Plan"): GamePlan => ({
  id: crypto.randomUUID(),
  name,
  players: [],
  schedule: createEmptySchedule(),
});

const migratePlanStructure = (plan: any): GamePlan => {
  let needsMigration = false;
  const newSchedule: Partial<QuarterSchedule> = {};

  if (!plan || !plan.schedule) {
    console.warn("Invalid plan structure for migration, creating new plan:", plan?.name);
    const newCreatedPlan = createNewGamePlan(plan?.name || "Migrated Plan (Invalid Structure)");
    // Ensure the new plan is also in gamePlans if it's a fresh start scenario from bad data
    // This part is tricky as migratePlanStructure is typically called within a map.
    // For now, it returns a valid new plan. The caller needs to handle its storage.
    return newCreatedPlan;
  }

  QUARTERS.forEach(qKey => {
    const oldQuarterData = plan.schedule[qKey];
    if (!oldQuarterData || !Array.isArray(oldQuarterData) || oldQuarterData.length !== PLAYERS_ON_COURT) {
      needsMigration = true;
      newSchedule[qKey] = Array(PLAYERS_ON_COURT).fill(null).map(() => []) as OnCourtPositions[typeof qKey];
      return;
    }

    const firstPositionOrSlot = oldQuarterData[0];
    // Check if the first element in the quarter's data is an array (new format) or an object/null (old format)
    if (!Array.isArray(firstPositionOrSlot)) { // Old format: [PlayerTimeSlot, PlayerTimeSlot, ...]
      needsMigration = true;
      newSchedule[qKey] = oldQuarterData.map((oldSlot: any) => {
        if (oldSlot && oldSlot.playerId) {
          return [{
            id: crypto.randomUUID(),
            playerId: oldSlot.playerId,
            minutes: typeof oldSlot.minutes === 'number' ? oldSlot.minutes : (oldSlot.playerId ? QUARTER_DURATION_MINUTES : 0),
          }];
        }
        return []; // Empty segments array for an empty old slot
      }) as OnCourtPositions[typeof qKey];
    } else { // Potentially new format: [[Segment,...], [Segment,...], ...]
      newSchedule[qKey] = oldQuarterData.map((positionSegments: any[]) => {
        if (!Array.isArray(positionSegments)) { // Should be an array, if not, it's malformed.
             needsMigration = true;
             return []; // Malformed, reset to empty segments for this position
        }
        return positionSegments.map(segment => {
          if (segment && typeof segment === 'object' && segment.playerId !== undefined) { // Valid segment structure
            if (!segment.id) { // Segment missing ID
              needsMigration = true;
              return { ...segment, id: crypto.randomUUID() };
            }
            return segment;
          }
          needsMigration = true; // Invalid segment found
          return null; // Mark for filtering
        }).filter(Boolean) as CourtPositionSegments; // Filter out nulls from invalid segments
      }) as OnCourtPositions[typeof qKey];
    }
  });
  
  if (needsMigration) {
     console.log("Migrating plan:", plan.name);
     return { ...plan, id: plan.id || crypto.randomUUID(), players: plan.players || [], schedule: newSchedule as QuarterSchedule };
  }
  return plan as GamePlan;
};


export function useCourtCommander() {
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<GamePlan | null>(null);
  const { toast } = useToast();

 useEffect(() => {
    try {
      const storedPlans = localStorage.getItem(LOCAL_STORAGE_KEY_PLANS);
      const storedCurrentPlanId = localStorage.getItem(LOCAL_STORAGE_KEY_CURRENT_PLAN_ID);
      
      const rawLoadedPlans: any[] = storedPlans ? JSON.parse(storedPlans) : [];
      const loadedPlans: GamePlan[] = rawLoadedPlans.map(migratePlanStructure).filter(p => p && p.id && p.name && p.schedule);

      setGamePlans(loadedPlans);

      if (loadedPlans.length > 0) {
        const planToLoad = storedCurrentPlanId 
          ? loadedPlans.find(p => p.id === storedCurrentPlanId) 
          : loadedPlans[0];
        setCurrentPlan(planToLoad || loadedPlans[0] || createNewGamePlan("Default Plan"));
      } else {
        const initialPlan = createNewGamePlan("Default Plan");
        setCurrentPlan(initialPlan);
        setGamePlans([initialPlan]); // Add the initial plan to gamePlans
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      toast({ title: "Error", description: "Could not load saved data. Resetting to default.", variant: "destructive" });
      const initialPlan = createNewGamePlan("Default Plan");
      setCurrentPlan(initialPlan);
      setGamePlans([initialPlan]);
    }
  }, [toast]); // Run only once on mount
  
  useEffect(() => {
    if (gamePlans.length > 0 && currentPlan) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(gamePlans));
            if (currentPlan.id) { // currentPlan itself could be null initially
                localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_PLAN_ID, currentPlan.id);
            }
        } catch (error) {
            console.error("Failed to save to localStorage:", error);
            toast({ title: "Error", description: "Could not save data.", variant: "destructive" });
        }
    } else if (gamePlans.length === 0 && localStorage.getItem(LOCAL_STORAGE_KEY_PLANS)) {
      // If all plans were deleted, clear local storage too
      localStorage.removeItem(LOCAL_STORAGE_KEY_PLANS);
      localStorage.removeItem(LOCAL_STORAGE_KEY_CURRENT_PLAN_ID);
    }
  }, [gamePlans, currentPlan, toast]);
  
  const updateCurrentPlan = useCallback((updatedPlan: GamePlan | null) => {
    if (!updatedPlan) { // Should not happen if logic is correct
        setCurrentPlan(null);
        setGamePlans(prevPlans => prevPlans.filter(p => p.id !== currentPlan?.id)); // remove if currentPlan was deleted
        return;
    }
    setCurrentPlan(updatedPlan);
    setGamePlans(prevPlans => {
        const existingPlanIndex = prevPlans.findIndex(p => p.id === updatedPlan.id);
        if (existingPlanIndex > -1) {
            const newPlans = [...prevPlans];
            newPlans[existingPlanIndex] = updatedPlan;
            return newPlans;
        }
        return [...prevPlans, updatedPlan]; // Should be rare, usually plans are updated or created then set
    });
  }, [currentPlan?.id]);

  const addPlayer = useCallback((player: Player) => {
    if (!currentPlan) return;
    const updatedPlan = { ...currentPlan, players: [...currentPlan.players, player] };
    updateCurrentPlan(updatedPlan);
    toast({ title: "Player Added", description: `${player.name} has been added.` });
  }, [currentPlan, updateCurrentPlan, toast]);

  const editPlayer = useCallback((updatedPlayer: Player) => {
    if (!currentPlan) return;
    const updatedPlayers = currentPlan.players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    updateCurrentPlan(updatedPlan);
    toast({ title: "Player Updated", description: `${updatedPlayer.name}'s details have been updated.` });
  }, [currentPlan, updateCurrentPlan, toast]);

  const deletePlayer = useCallback((playerId: string) => {
    if (!currentPlan) return;
    const playerToRemove = currentPlan.players.find(p => p.id === playerId);
    const updatedPlayers = currentPlan.players.filter(p => p.id !== playerId);
    
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    QUARTERS.forEach(qKey => {
      newSchedule[qKey].forEach((positionSegments, posIdx) => {
        newSchedule[qKey][posIdx] = positionSegments.filter(segment => segment.playerId !== playerId);
      });
    });
    const updatedPlan = { ...currentPlan, players: updatedPlayers, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
    toast({ title: "Player Deleted", description: `${playerToRemove?.name || 'Player'} has been removed and unassigned.` });
  }, [currentPlan, updateCurrentPlan, toast]);

 const assignPlayerToPosition = useCallback((
    playerId: string,
    targetQuarter: QuarterKey,
    targetPositionIndex: number,
    draggedInfo: DraggedPlayerInfo // Contains source info
  ) => {
    if (!currentPlan) return;
    let newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;

    // 1. Remove from source if dragged from timeline
    if (draggedInfo.sourceType === 'timeline' && draggedInfo.sourceQuarter && draggedInfo.sourcePositionIndex !== undefined && draggedInfo.sourceSegmentId) {
      const sourceSegments = newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex];
      newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex] = sourceSegments.filter(
        (segment) => segment.id !== draggedInfo.sourceSegmentId
      );
    }

    // 2. Remove other instances of this player in the *target quarter* to prevent duplicates in same quarter.
    // This simplifies logic by ensuring a player can only have one active segment per quarter.
    // If a more complex scenario is needed (player subs in/out in same quarter for *different* positions), this would need adjustment.
    QUARTERS.forEach(qKey => {
        if (qKey === targetQuarter) { // Only for the target quarter
            newSchedule[qKey].forEach((positionSegments, posIdx) => {
                 // If assigning to this position, don't remove from itself if it was a move within position (handled by source removal)
                if (posIdx !== targetPositionIndex || draggedInfo.sourcePositionIndex !== targetPositionIndex || draggedInfo.sourceQuarter !== targetQuarter) {
                    newSchedule[qKey][posIdx] = positionSegments.filter(segment => segment.playerId !== playerId);
                }
            });
        }
    });


    // 3. Add to target position
    const targetPositionSegments = newSchedule[targetQuarter][targetPositionIndex];
    const newSegment: PlayerTimeSegment = {
      id: crypto.randomUUID(),
      playerId,
      minutes: targetPositionSegments.length === 0 ? QUARTER_DURATION_MINUTES : 6, // Default minutes
    };
    targetPositionSegments.push(newSegment);
    newSchedule[targetQuarter][targetPositionIndex] = targetPositionSegments;

    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
  }, [currentPlan, updateCurrentPlan]);


  const unassignPlayerSegment = useCallback((quarter: QuarterKey, positionIndex: number, segmentId: string) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    const positionSegments = newSchedule[quarter][positionIndex];
    newSchedule[quarter][positionIndex] = positionSegments.filter(segment => segment.id !== segmentId);
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
  }, [currentPlan, updateCurrentPlan]);

  const updatePlayerMinutesInSegment = useCallback((quarterKey: QuarterKey, positionIndex: number, segmentId: string, minutes: number) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    const positionSegments = newSchedule[quarterKey][positionIndex];
    const segmentIndex = positionSegments.findIndex(seg => seg.id === segmentId);

    if (segmentIndex !== -1) {
      const validatedMinutes = Math.max(0, Math.min(minutes, QUARTER_DURATION_MINUTES));
      positionSegments[segmentIndex].minutes = validatedMinutes;

      // Validate total minutes for the position
      const totalMinutesInPosition = positionSegments.reduce((sum, seg) => sum + seg.minutes, 0);
      if (totalMinutesInPosition > QUARTER_DURATION_MINUTES) {
        toast({
          title: "Time Warning",
          description: `Total minutes in this position for ${quarterKey} exceeds ${QUARTER_DURATION_MINUTES}. Please adjust.`,
          variant: "destructive",
        });
      }
      newSchedule[quarterKey][positionIndex] = positionSegments;
      const updatedPlan = { ...currentPlan, schedule: newSchedule };
      updateCurrentPlan(updatedPlan);
    }
  }, [currentPlan, updateCurrentPlan, toast]);


  const saveCurrentGamePlanAs = useCallback((name: string) => {
    if (!currentPlan) return;
    const newPlan = { ...currentPlan, name: name, id: crypto.randomUUID() };
    setGamePlans(prev => [...prev, newPlan]);
    setCurrentPlan(newPlan);
    toast({ title: "Game Plan Saved", description: `"${name}" has been saved.` });
  }, [currentPlan, toast]);
  
  const updateGamePlanName = useCallback((planId: string, newName: string) => {
    const planToUpdate = gamePlans.find(p => p.id === planId);
    if (planToUpdate) {
      const updatedRenamedPlan = { ...planToUpdate, name: newName };
      if (currentPlan && currentPlan.id === planId) {
        setCurrentPlan(updatedRenamedPlan);
      }
      setGamePlans(prevPlans => prevPlans.map(p => p.id === planId ? updatedRenamedPlan : p));
      toast({ title: "Plan Renamed", description: `Plan renamed to "${newName}".` });
    }
  }, [gamePlans, currentPlan, toast]);

  const loadGamePlan = useCallback((planId: string) => {
    const planToLoad = gamePlans.find(p => p.id === planId);
    if (planToLoad) {
      setCurrentPlan(planToLoad);
      toast({ title: "Game Plan Loaded", description: `"${planToLoad.name}" has been loaded.` });
    } else {
      toast({ title: "Error", description: "Could not find game plan to load.", variant: "destructive" });
    }
  }, [gamePlans, toast]);

  const createAndLoadNewGamePlan = useCallback(() => {
    const newPlanName = `Game Plan ${gamePlans.length + 1}`;
    const newPlanInstance = createNewGamePlan(newPlanName);
    setGamePlans(prev => [...prev, newPlanInstance]);
    setCurrentPlan(newPlanInstance);
    toast({ title: "New Plan Created", description: `"${newPlanName}" is ready.` });
  }, [gamePlans, toast]);

  const deleteGamePlan = useCallback((planId: string) => {
    if (gamePlans.length <= 1) {
      toast({ title: "Cannot Delete", description: "You must have at least one game plan.", variant: "destructive" });
      return;
    }
    const planToDelete = gamePlans.find(p => p.id === planId);
    const remainingPlans = gamePlans.filter(p => p.id !== planId);
    setGamePlans(remainingPlans);
    
    if (currentPlan && currentPlan.id === planId) {
      setCurrentPlan(remainingPlans[0] || createNewGamePlan("Default Plan")); // fallback to new if list becomes empty (should be handled by length check)
    }
    toast({ title: "Plan Deleted", description: `"${planToDelete?.name || 'Plan'}" deleted.`});
  }, [gamePlans, currentPlan, toast]);

  const getPlayerTotalTime = useCallback((playerId: string): number => {
    if (!currentPlan?.schedule) return 0;
    let totalMinutes = 0;
    QUARTERS.forEach(qKey => {
      currentPlan.schedule[qKey].forEach(positionSegments => {
        positionSegments.forEach(segment => {
          if (segment.playerId === playerId) {
            totalMinutes += segment.minutes;
          }
        });
      });
    });
    return totalMinutes;
  }, [currentPlan]);

  return {
    currentPlan,
    gamePlans,
    players: currentPlan?.players || [],
    schedule: currentPlan?.schedule || createEmptySchedule(),
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
  };
}
