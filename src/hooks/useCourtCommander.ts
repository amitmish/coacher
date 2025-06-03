
"use client";

import type { Player, GamePlan, QuarterSchedule, QuarterKey, OnCourtPositions, PlayerTimeSegment, DraggedPlayerInfo, CourtPositionSegments } from "@/lib/types";
import { QUARTERS, PLAYERS_ON_COURT, QUARTER_DURATION_MINUTES } from "@/lib/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase"; // Firebase Realtime Database instance
import {
  ref,
  onValue,
  set,
  remove,
} from "firebase/database";

const GAME_PLANS_PATH = "gamePlans"; // Path in Realtime Database

const createEmptySchedule = (): QuarterSchedule => {
  const emptyPosition = (): CourtPositionSegments => [];
  return {
    Q1: Array(PLAYERS_ON_COURT).fill(null).map(emptyPosition) as OnCourtPositions,
    Q2: Array(PLAYERS_ON_COURT).fill(null).map(emptyPosition) as OnCourtPositions,
    Q3: Array(PLAYERS_ON_COURT).fill(null).map(emptyPosition) as OnCourtPositions,
    Q4: Array(PLAYERS_ON_COURT).fill(null).map(emptyPosition) as OnCourtPositions,
  };
};

const createNewGamePlanObject = (name: string = "New Game Plan", id?: string): GamePlan => ({
  id: id || crypto.randomUUID(),
  name,
  players: [],
  schedule: createEmptySchedule(),
});

const migratePlanStructure = (planData: any): GamePlan => {
  // Ensure basic plan structure
  const id = planData?.id ? String(planData.id) : crypto.randomUUID();
  const name = planData?.name ? String(planData.name) : "Recovered Plan";

  let parsedPlayers: Player[] = [];
  if (Array.isArray(planData?.players)) {
    parsedPlayers = planData.players;
  } else if (typeof planData?.players === 'object' && planData.players !== null) {
    parsedPlayers = Object.values(planData.players);
  } // If planData.players is undefined or null, parsedPlayers remains []

  const finalPlayers: Player[] = parsedPlayers.map((p: any) => {
    if (p && typeof p.id === 'string' && typeof p.name === 'string') {
      return {
        id: p.id,
        name: p.name,
        jerseyNumber: typeof p.jerseyNumber === 'string' ? p.jerseyNumber : "",
        position: typeof p.position === 'string' ? p.position : "",
      };
    }
    return null;
  }).filter(Boolean) as Player[];


  const newSchedule: Partial<QuarterSchedule> = {};
  let scheduleNeedsMigration = false;
  QUARTERS.forEach(qKey => {
    const oldQuarterData = planData?.schedule?.[qKey];
    if (!oldQuarterData || !Array.isArray(oldQuarterData) || oldQuarterData.length !== PLAYERS_ON_COURT) {
      scheduleNeedsMigration = true;
      newSchedule[qKey] = Array(PLAYERS_ON_COURT).fill(null).map(() => []) as OnCourtPositions[typeof qKey];
      return;
    }

    newSchedule[qKey] = oldQuarterData.map((positionSegments: any) => {
      let segmentsArray: any[] = [];
      if (Array.isArray(positionSegments)) {
        segmentsArray = positionSegments;
      } else if (typeof positionSegments === 'object' && positionSegments !== null) {
        segmentsArray = Object.values(positionSegments);
        scheduleNeedsMigration = true;
      } else {
        scheduleNeedsMigration = true; // Missing or invalid position, default to empty
        return [];
      }
      
      return segmentsArray.map((segment: any) => {
        if (segment && typeof segment === 'object' && segment.playerId !== undefined && typeof segment.minutes === 'number') {
          return { ...segment, id: segment.id || crypto.randomUUID() };
        }
        scheduleNeedsMigration = true;
        return null;
      }).filter(Boolean) as CourtPositionSegments;
    }) as OnCourtPositions[typeof qKey];
  });
  
  if (scheduleNeedsMigration) {
    // console.log("Migrating schedule structure for plan ID:", id, "Name:", name);
  }

  return {
    id,
    name,
    players: finalPlayers,
    schedule: newSchedule as QuarterSchedule,
  };
};


export function useCourtCommander() {
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const currentPlan = useMemo(() => {
    if (!currentPlanId || gamePlans.length === 0) return null;
    // migratePlanStructure ensures plan.players is an array.
    return gamePlans.find(p => p.id === currentPlanId) || null;
  }, [gamePlans, currentPlanId]);

  useEffect(() => {
    setIsLoading(true);
    const gamePlansRef = ref(db, GAME_PLANS_PATH);
    
    const unsubscribe = onValue(gamePlansRef, async (snapshot) => {
      const data = snapshot.val();
      let loadedPlans: GamePlan[] = [];

      if (data && typeof data === 'object') {
        loadedPlans = Object.keys(data).map(key => migratePlanStructure({ ...data[key], id: key }));
      }
      
      setGamePlans(loadedPlans);

      if (loadedPlans.length === 0) {
        const initialPlan = createNewGamePlanObject("Default Plan");
        try {
          await set(ref(db, `${GAME_PLANS_PATH}/${initialPlan.id}`), initialPlan);
          // setCurrentPlanId will be handled by the next onValue call or the logic below
        } catch (error) {
          console.error("Failed to create initial plan:", error);
          toast({ title: "Error", description: "Could not create initial game plan.", variant: "destructive"});
        }
      } else if (!currentPlanId || !loadedPlans.some(p => p.id === currentPlanId)) {
        setCurrentPlanId(loadedPlans[0].id);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching game plans from Realtime Database:", error);
      toast({ title: "Database Error", description: "Could not connect to the Realtime Database.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentPlanId, toast]); // currentPlanId dependency ensures re-subscription if it changes (e.g. new plan loaded)

  const savePlanToDatabase = useCallback(async (plan: GamePlan) => {
    if (!plan.id) {
      console.error("Plan must have an ID to be saved.");
      toast({ title: "Error", description: "Plan has no ID.", variant: "destructive"});
      return;
    }
    try {
      // Ensure players is an array before saving. migratePlanStructure should handle this on read,
      // and action callbacks should maintain it as an array. This is a final safeguard.
      const planToSave = {
        ...plan,
        players: Array.isArray(plan.players) ? plan.players : Object.values(plan.players || {}),
      };
      await set(ref(db, `${GAME_PLANS_PATH}/${plan.id}`), planToSave);
    } catch (error) {
      console.error("Error saving plan to Realtime Database:", error);
      toast({ title: "Save Error", description: "Could not save plan to database.", variant: "destructive" });
    }
  }, [toast]);

  const addPlayer = useCallback(async (player: Player) => {
    if (!currentPlan) {
      toast({ title: "Error", description: "No current plan selected to add player.", variant: "destructive"});
      return;
    }

    let currentPlayersList: Player[] = [];
    if (currentPlan.players) {
      if (Array.isArray(currentPlan.players)) {
        currentPlayersList = currentPlan.players;
      } else if (typeof currentPlan.players === 'object' && currentPlan.players !== null) {
        // This path should ideally not be taken if currentPlan is derived from migrated data
        currentPlayersList = Object.values(currentPlan.players as Record<string, Player>);
      }
    }
    
    const updatedPlayers = [...currentPlayersList, player];
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    await savePlanToDatabase(updatedPlan);
    toast({ title: "Player Added", description: `${player.name} has been added.` });
  }, [currentPlan, savePlanToDatabase, toast]);

  const editPlayer = useCallback(async (updatedPlayer: Player) => {
    if (!currentPlan) return;
    
    let currentPlayersList: Player[] = [];
    if (currentPlan.players) {
      if (Array.isArray(currentPlan.players)) {
        currentPlayersList = currentPlan.players;
      } else if (typeof currentPlan.players === 'object' && currentPlan.players !== null) {
        currentPlayersList = Object.values(currentPlan.players as Record<string, Player>);
      }
    }

    const updatedPlayers = currentPlayersList.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    await savePlanToDatabase(updatedPlan);
    toast({ title: "Player Updated", description: `${updatedPlayer.name}'s details have been updated.` });
  }, [currentPlan, savePlanToDatabase, toast]);

  const deletePlayer = useCallback(async (playerId: string) => {
    if (!currentPlan) return;

    let currentPlayersList: Player[] = [];
    if (currentPlan.players) {
      if (Array.isArray(currentPlan.players)) {
        currentPlayersList = currentPlan.players;
      } else if (typeof currentPlan.players === 'object' && currentPlan.players !== null) {
        currentPlayersList = Object.values(currentPlan.players as Record<string, Player>);
      }
    }
    const playerToRemove = currentPlayersList.find(p => p.id === playerId);
    const updatedPlayers = currentPlayersList.filter(p => p.id !== playerId);
    
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule; // Deep copy
    QUARTERS.forEach(qKey => {
      // Ensure each position in the schedule is an array
      newSchedule[qKey].forEach((_, posIdx) => {
        if (!Array.isArray(newSchedule[qKey][posIdx])) {
          newSchedule[qKey][posIdx] = Object.values(newSchedule[qKey][posIdx] || {}) as CourtPositionSegments;
        }
        newSchedule[qKey][posIdx] = newSchedule[qKey][posIdx].filter(segment => segment.playerId !== playerId);
      });
    });
    const updatedPlan = { ...currentPlan, players: updatedPlayers, schedule: newSchedule };
    await savePlanToDatabase(updatedPlan);
    toast({ title: "Player Deleted", description: `${playerToRemove?.name || 'Player'} has been removed and unassigned.` });
  }, [currentPlan, savePlanToDatabase, toast]);

 const assignPlayerToPosition = useCallback(async (
    playerId: string,
    targetQuarter: QuarterKey,
    targetPositionIndex: number,
    draggedInfo: DraggedPlayerInfo
  ) => {
    if (!currentPlan) return;
    let newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;

    const ensureArrayForPosition = (quarter: QuarterKey, posIdx: number) => {
        if (!newSchedule[quarter][posIdx] || !Array.isArray(newSchedule[quarter][posIdx])) {
            newSchedule[quarter][posIdx] = Array.isArray(newSchedule[quarter][posIdx]) 
                ? newSchedule[quarter][posIdx] 
                : Object.values(newSchedule[quarter][posIdx] || {}) as CourtPositionSegments;
        }
    };
    
    QUARTERS.forEach(q => {
        for (let i = 0; i < PLAYERS_ON_COURT; i++) {
            ensureArrayForPosition(q, i);
        }
    });

    if (draggedInfo.sourceType === 'timeline' && draggedInfo.sourceQuarter && typeof draggedInfo.sourcePositionIndex === 'number' && draggedInfo.sourceSegmentId) {
      ensureArrayForPosition(draggedInfo.sourceQuarter, draggedInfo.sourcePositionIndex);
      const sourceSegments = newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex];
      newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex] = sourceSegments.filter(
        (segment) => segment.id !== draggedInfo.sourceSegmentId
      );
    }
    
    // Remove player from other positions in the same target quarter IF NOT dragging within the same position
    if (!(draggedInfo.sourceType === 'timeline' && draggedInfo.sourceQuarter === targetQuarter && draggedInfo.sourcePositionIndex === targetPositionIndex)) {
       newSchedule[targetQuarter].forEach((_, posIdx) => {
        ensureArrayForPosition(targetQuarter, posIdx);
        // Only remove if it's not the target position itself, to allow multiple segments of same player in one position.
        // This logic might need refinement based on exact desired behavior for multi-segment per player.
        // For now, it allows player to be in multiple segments in one position, but removes from *other* positions in same quarter.
        if (posIdx !== targetPositionIndex) { 
          newSchedule[targetQuarter][posIdx] = newSchedule[targetQuarter][posIdx].filter(segment => segment.playerId !== playerId);
        }
      });
    }

    ensureArrayForPosition(targetQuarter, targetPositionIndex);
    const targetPositionSegments = newSchedule[targetQuarter][targetPositionIndex];
    const newSegment: PlayerTimeSegment = {
      id: crypto.randomUUID(),
      playerId,
      minutes: targetPositionSegments.length === 0 ? QUARTER_DURATION_MINUTES : 6, // Default minutes
    };
    targetPositionSegments.push(newSegment);

    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    await savePlanToDatabase(updatedPlan);
  }, [currentPlan, savePlanToDatabase]);

  const unassignPlayerSegment = useCallback(async (quarter: QuarterKey, positionIndex: number, segmentId: string) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    
    const ensureArrayForPosition = (q: QuarterKey, pIndex: number) => {
        if (!newSchedule[q][pIndex] || !Array.isArray(newSchedule[q][pIndex])) {
             newSchedule[q][pIndex] = Array.isArray(newSchedule[q][pIndex]) 
                ? newSchedule[q][pIndex] 
                : Object.values(newSchedule[q][pIndex] || {}) as CourtPositionSegments;
        }
    };
    ensureArrayForPosition(quarter, positionIndex);

    const positionSegments = newSchedule[quarter][positionIndex];
    newSchedule[quarter][positionIndex] = positionSegments.filter(segment => segment.id !== segmentId);
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    await savePlanToDatabase(updatedPlan);
  }, [currentPlan, savePlanToDatabase]);

  const updatePlayerMinutesInSegment = useCallback(async (quarterKey: QuarterKey, positionIndex: number, segmentId: string, minutes: number) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;

    const ensureArrayForPosition = (q: QuarterKey, pIndex: number) => {
         if (!newSchedule[q][pIndex] || !Array.isArray(newSchedule[q][pIndex])) {
             newSchedule[q][pIndex] = Array.isArray(newSchedule[q][pIndex]) 
                ? newSchedule[q][pIndex] 
                : Object.values(newSchedule[q][pIndex] || {}) as CourtPositionSegments;
        }
    };
    ensureArrayForPosition(quarterKey, positionIndex);

    const positionSegments = newSchedule[quarterKey][positionIndex];
    const segmentIndex = positionSegments.findIndex(seg => seg.id === segmentId);

    if (segmentIndex !== -1) {
      const validatedMinutes = Math.max(0, Math.min(minutes, QUARTER_DURATION_MINUTES));
      positionSegments[segmentIndex].minutes = validatedMinutes;

      const totalMinutesInPosition = positionSegments.reduce((sum, seg) => sum + seg.minutes, 0);
      if (totalMinutesInPosition > QUARTER_DURATION_MINUTES) {
        toast({
          title: "Time Warning",
          description: `Total minutes in this position for ${quarterKey} exceeds ${QUARTER_DURATION_MINUTES}. Please adjust.`,
          variant: "destructive",
        });
      }
      const updatedPlan = { ...currentPlan, schedule: newSchedule };
      await savePlanToDatabase(updatedPlan);
    }
  }, [currentPlan, savePlanToDatabase, toast]);

  const saveCurrentGamePlanAs = useCallback(async (name: string) => {
    if (!currentPlan) {
        toast({ title: "Error", description: "No current plan to save.", variant: "destructive"});
        return;
    }
    const newPlanId = crypto.randomUUID();
    // Deep copy current plan and ensure players is an array
    const planToSave = JSON.parse(JSON.stringify(currentPlan));
    const newPlanData = { 
        ...planToSave, 
        name: name, 
        id: newPlanId,
        players: Array.isArray(planToSave.players) ? planToSave.players : Object.values(planToSave.players || {})
    };
    
    await set(ref(db, `${GAME_PLANS_PATH}/${newPlanId}`), newPlanData);
    setCurrentPlanId(newPlanId); // Switch to the new plan
    toast({ title: "Game Plan Saved As", description: `"${name}" has been saved.` });
  }, [currentPlan, toast]);
  
  const updateGamePlanName = useCallback(async (planId: string, newName: string) => {
    const planToUpdate = gamePlans.find(p => p.id === planId);
    if (planToUpdate) {
      const updatedRenamedPlan = { ...planToUpdate, name: newName };
      await savePlanToDatabase(updatedRenamedPlan); // savePlanToDatabase ensures players is array
      toast({ title: "Plan Renamed", description: `Plan renamed to "${newName}".` });
    }
  }, [gamePlans, savePlanToDatabase, toast]);

  const loadGamePlan = useCallback((planId: string) => {
    const planToLoad = gamePlans.find(p => p.id === planId);
    if (planToLoad) {
      setCurrentPlanId(planId);
      toast({ title: "Game Plan Loaded", description: `"${planToLoad.name}" has been loaded.` });
    } else {
      toast({ title: "Error", description: "Could not find game plan to load.", variant: "destructive" });
    }
  }, [gamePlans, toast]);

  const createAndLoadNewGamePlan = useCallback(async () => {
    const newPlanName = `Game Plan ${gamePlans.length + 1}`;
    const newPlanInstance = createNewGamePlanObject(newPlanName); // players will be []
    try {
      await set(ref(db, `${GAME_PLANS_PATH}/${newPlanInstance.id}`), newPlanInstance);
      setCurrentPlanId(newPlanInstance.id); 
      toast({ title: "New Plan Created", description: `"${newPlanName}" is ready.` });
    } catch (error) {
      console.error("Error creating new plan in Realtime Database:", error);
      toast({ title: "Error", description: "Could not create new plan.", variant: "destructive"});
    }
  }, [gamePlans.length, toast]); // gamePlans (not gamePlans.length) for correct closure

  const deleteGamePlan = useCallback(async (planId: string) => {
    if (gamePlans.length <= 1) {
      toast({ title: "Cannot Delete", description: "You must have at least one game plan.", variant: "destructive" });
      return;
    }
    const planToDelete = gamePlans.find(p => p.id === planId);
    try {
      await remove(ref(db, `${GAME_PLANS_PATH}/${planId}`));
      toast({ title: "Plan Deleted", description: `"${planToDelete?.name || 'Plan'}" deleted.`});
       if (currentPlanId === planId) {
        // currentPlanId will be reset by the onValue listener's logic if it becomes invalid
         setCurrentPlanId(null); // Explicitly nullify, onValue will pick a new one
      }
    } catch (error) {
      console.error("Error deleting plan from Realtime Database:", error);
      toast({ title: "Error", description: "Could not delete plan.", variant: "destructive" });
    }
  }, [gamePlans, currentPlanId, toast]);

  const getPlayerTotalTime = useCallback((playerId: string): number => {
    if (!currentPlan?.schedule) return 0;
    let totalMinutes = 0;
    QUARTERS.forEach(qKey => {
      const positionsInQuarter = Array.isArray(currentPlan.schedule[qKey]) 
        ? currentPlan.schedule[qKey] 
        : Object.values(currentPlan.schedule[qKey] || {});

      positionsInQuarter.forEach(positionSegmentsObj => {
        const segmentsArray = Array.isArray(positionSegmentsObj)
          ? positionSegmentsObj
          : Object.values(positionSegmentsObj || {});
          
        segmentsArray.forEach(segment => {
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
    isLoading,
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

