
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
  serverTimestamp // For potential future use
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
  players: [], // Always initialize as an empty array
  schedule: createEmptySchedule(),
  // lastModified: serverTimestamp(), // Example for future use
});

// Helper function to ensure a part of the schedule is an array
const ensureArrayStructure = (data: any): any[] => {
  if (Array.isArray(data)) {
    return data;
  }
  if (typeof data === 'object' && data !== null) {
    // Convert object with numeric keys to array, respecting order if possible
    // This is a common way Firebase RTDB might store arrays
    const keys = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
    return keys.map(key => data[key]);
  }
  return []; // Default to empty array if not array or suitable object
};


const migratePlanStructure = (planData: any): GamePlan => {
  const id = planData?.id ? String(planData.id) : crypto.randomUUID();
  const name = planData?.name ? String(planData.name) : "Recovered Plan";

  // Robustly parse players
  let parsedPlayers: Player[] = [];
  if (planData?.players) {
      parsedPlayers = ensureArrayStructure(planData.players);
  }
  
  const finalPlayers: Player[] = parsedPlayers.map((p: any) => {
    if (p && typeof p.id === 'string' && typeof p.name === 'string') {
      return {
        id: p.id,
        name: p.name,
        jerseyNumber: typeof p.jerseyNumber === 'string' || typeof p.jerseyNumber === 'number' ? String(p.jerseyNumber) : "", // Allow number then convert
        position: typeof p.position === 'string' ? p.position : "",
      };
    }
    return null;
  }).filter(Boolean) as Player[];

  const newSchedule: Partial<QuarterSchedule> = {};
  QUARTERS.forEach(qKey => {
    const quarterDataFromDb = planData?.schedule?.[qKey];
    const positionsInQuarter: OnCourtPositions[typeof qKey] = Array(PLAYERS_ON_COURT).fill(null)
      .map(() => []) as OnCourtPositions[typeof qKey];

    if (quarterDataFromDb) {
      const parsedQuarterPositions = ensureArrayStructure(quarterDataFromDb);
      parsedQuarterPositions.forEach((positionSegmentsData: any, posIdx: number) => {
        if (posIdx < PLAYERS_ON_COURT) {
          const segmentsArray = ensureArrayStructure(positionSegmentsData);
          positionsInQuarter[posIdx] = segmentsArray.map((segment: any) => {
            if (segment && segment.playerId !== undefined && typeof segment.minutes === 'number') {
              return { ...segment, id: segment.id || crypto.randomUUID() };
            }
            return null;
          }).filter(Boolean) as CourtPositionSegments;
        }
      });
    }
    newSchedule[qKey] = positionsInQuarter;
  });
  
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
    const foundPlan = gamePlans.find(p => p.id === currentPlanId);
    return foundPlan ? migratePlanStructure(foundPlan) : null; // Ensure structure is always migrated
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
        setCurrentPlanId(loadedPlans[0]?.id || null); // Fallback to null if loadedPlans[0] is undefined
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching game plans from Realtime Database:", error);
      toast({ title: "Database Error", description: "Could not connect to the Realtime Database.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]); // Removed currentPlanId, onValue handles re-fetch and plan selection logic

  const savePlanToDatabase = useCallback(async (plan: GamePlan | null) => {
    if (!plan || !plan.id) {
      console.error("Plan must have an ID and exist to be saved.");
      toast({ title: "Error", description: "Plan has no ID or does not exist.", variant: "destructive"});
      return;
    }
    try {
      // Ensure players is an array and schedule segments are arrays before saving.
      const planToSave = {
        ...plan,
        players: ensureArrayStructure(plan.players),
        schedule: Object.fromEntries(
          QUARTERS.map(qKey => [
            qKey,
            ensureArrayStructure(plan.schedule[qKey]).map(pos => ensureArrayStructure(pos))
          ])
        ) as QuarterSchedule
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
    // Ensure currentPlan.players is treated as an array
    const currentPlayersList = ensureArrayStructure(currentPlan.players);
    const updatedPlayers = [...currentPlayersList, player];
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    await savePlanToDatabase(updatedPlan);
    toast({ title: "Player Added", description: `${player.name} has been added.` });
  }, [currentPlan, savePlanToDatabase, toast]);

  const editPlayer = useCallback(async (updatedPlayer: Player) => {
    if (!currentPlan) return;
    const currentPlayersList = ensureArrayStructure(currentPlan.players);
    const updatedPlayers = currentPlayersList.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    await savePlanToDatabase(updatedPlan);
    toast({ title: "Player Updated", description: `${updatedPlayer.name}'s details have been updated.` });
  }, [currentPlan, savePlanToDatabase, toast]);

  const deletePlayer = useCallback(async (playerId: string) => {
    if (!currentPlan) return;
    const currentPlayersList = ensureArrayStructure(currentPlan.players);
    const playerToRemove = currentPlayersList.find(p => p.id === playerId);
    const updatedPlayers = currentPlayersList.filter(p => p.id !== playerId);
    
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule; 
    QUARTERS.forEach(qKey => {
      newSchedule[qKey].forEach((_, posIdx) => {
        // Ensure this part of the schedule is an array of segments
        newSchedule[qKey][posIdx] = ensureArrayStructure(newSchedule[qKey][posIdx]);
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

    const ensureArrayForPositionInSchedule = (quarter: QuarterKey, posIdx: number) => {
        if (!newSchedule[quarter][posIdx] || !Array.isArray(newSchedule[quarter][posIdx])) {
            newSchedule[quarter][posIdx] = ensureArrayStructure(newSchedule[quarter][posIdx]);
        }
    };
    
    QUARTERS.forEach(q => {
        for (let i = 0; i < PLAYERS_ON_COURT; i++) {
            ensureArrayForPositionInSchedule(q, i);
        }
    });

    // If dragged from timeline, remove from original spot
    if (draggedInfo.sourceType === 'timeline' && 
        draggedInfo.sourceQuarter && 
        typeof draggedInfo.sourcePositionIndex === 'number' && 
        draggedInfo.sourceSegmentId) {
      
      ensureArrayForPositionInSchedule(draggedInfo.sourceQuarter, draggedInfo.sourcePositionIndex);
      const sourceSegments = newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex];
      newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex] = sourceSegments.filter(
        (segment) => segment.id !== draggedInfo.sourceSegmentId
      );
    }
    
    ensureArrayForPositionInSchedule(targetQuarter, targetPositionIndex);
    const targetPositionSegments = newSchedule[targetQuarter][targetPositionIndex];

    // Check if player is already in this exact position (segment) to avoid duplicates if logic allows multiple segments of same player
    // This example assumes one player segment per type of drag for now, might need more complex logic for multiple segments
    // const existingSegmentIndex = targetPositionSegments.findIndex(seg => seg.playerId === playerId);

    const newSegment: PlayerTimeSegment = {
      id: crypto.randomUUID(),
      playerId,
      minutes: QUARTER_DURATION_MINUTES / (targetPositionSegments.length +1), // Distribute time or use default
    };
    
    // Simple add:
    targetPositionSegments.push(newSegment);
    
    // Normalize minutes if needed (example: ensure total does not exceed QUARTER_DURATION_MINUTES)
    // This logic can be complex and depends on desired behavior. For now, simple add.

    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    await savePlanToDatabase(updatedPlan);
  }, [currentPlan, savePlanToDatabase]);

  const unassignPlayerSegment = useCallback(async (quarter: QuarterKey, positionIndex: number, segmentId: string) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    
    const ensureArrayForPositionInSchedule = (q: QuarterKey, pIndex: number) => {
        if (!newSchedule[q][pIndex] || !Array.isArray(newSchedule[q][pIndex])) {
            newSchedule[q][pIndex] = ensureArrayStructure(newSchedule[q][pIndex]);
        }
    };
    ensureArrayForPositionInSchedule(quarter, positionIndex);

    const positionSegments = newSchedule[quarter][positionIndex];
    newSchedule[quarter][positionIndex] = positionSegments.filter(segment => segment.id !== segmentId);
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    await savePlanToDatabase(updatedPlan);
  }, [currentPlan, savePlanToDatabase]);

  const updatePlayerMinutesInSegment = useCallback(async (quarterKey: QuarterKey, positionIndex: number, segmentId: string, minutes: number) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;

    const ensureArrayForPositionInSchedule = (q: QuarterKey, pIndex: number) => {
         if (!newSchedule[q][pIndex] || !Array.isArray(newSchedule[q][pIndex])) {
             newSchedule[q][pIndex] = ensureArrayStructure(newSchedule[q][pIndex]);
        }
    };
    ensureArrayForPositionInSchedule(quarterKey, positionIndex);

    const positionSegments = newSchedule[quarterKey][positionIndex];
    const segmentIndex = positionSegments.findIndex(seg => seg.id === segmentId);

    if (segmentIndex !== -1) {
      const validatedMinutes = Math.max(0, Math.min(Math.round(minutes), QUARTER_DURATION_MINUTES)); // Round minutes
      positionSegments[segmentIndex].minutes = validatedMinutes;

      const totalMinutesInPosition = positionSegments.reduce((sum, seg) => sum + seg.minutes, 0);
      if (totalMinutesInPosition > QUARTER_DURATION_MINUTES) {
        toast({
          title: "Time Warning",
          description: `Total minutes in this position for ${quarterKey} (${totalMinutesInPosition}) exceeds ${QUARTER_DURATION_MINUTES}. Please adjust.`,
          variant: "destructive",
          duration: 5000,
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
    const planToSave = JSON.parse(JSON.stringify(currentPlan));
    const newPlanData: GamePlan = { 
        ...planToSave, 
        name: name.trim() || "Unnamed Plan", 
        id: newPlanId,
        players: ensureArrayStructure(planToSave.players), // Ensure players is array
         schedule: Object.fromEntries(
          QUARTERS.map(qKey => [
            qKey,
            ensureArrayStructure(planToSave.schedule[qKey]).map(pos => ensureArrayStructure(pos))
          ])
        ) as QuarterSchedule
    };
    
    await set(ref(db, `${GAME_PLANS_PATH}/${newPlanId}`), newPlanData);
    setCurrentPlanId(newPlanId); // Switch to the new plan
    toast({ title: "Game Plan Saved As", description: `"${newPlanData.name}" has been saved.` });
  }, [currentPlan, toast]);
  
  const updateGamePlanName = useCallback(async (planId: string, newName: string) => {
    const planToUpdate = gamePlans.find(p => p.id === planId);
    if (planToUpdate) {
      const updatedRenamedPlan = { ...planToUpdate, name: newName.trim() || "Unnamed Plan" };
      await savePlanToDatabase(updatedRenamedPlan);
      toast({ title: "Plan Renamed", description: `Plan renamed to "${updatedRenamedPlan.name}".` });
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
    const newPlanInstance = createNewGamePlanObject(newPlanName);
    try {
      await set(ref(db, `${GAME_PLANS_PATH}/${newPlanInstance.id}`), newPlanInstance);
      // onValue listener will pick up the new plan and update gamePlans state
      // setCurrentPlanId will be set if it's the only plan or if currentPlanId becomes invalid
      toast({ title: "New Plan Created", description: `"${newPlanName}" is ready.` });
    } catch (error) {
      console.error("Error creating new plan in Realtime Database:", error);
      toast({ title: "Error", description: "Could not create new plan.", variant: "destructive"});
    }
  }, [gamePlans, toast]); // Depends on current gamePlans to name correctly.

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
         setCurrentPlanId(null); // onValue will pick a new one
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
      const positionsInQuarter = ensureArrayStructure(currentPlan.schedule[qKey]);
      positionsInQuarter.forEach(positionSegmentsObj => {
        const segmentsArray = ensureArrayStructure(positionSegmentsObj);
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
    gamePlans, // The raw list from DB, currentPlan is the processed one
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

