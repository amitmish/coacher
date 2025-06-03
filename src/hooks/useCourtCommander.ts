
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

const migratePlanStructure = (plan: any): GamePlan => {
  if (!plan || !plan.id || typeof plan.name !== 'string' || typeof plan.schedule !== 'object' || plan.schedule === null) {
    console.warn("Invalid plan structure received, attempting to create a valid default:", plan);
    return createNewGamePlanObject(plan?.name || "Recovered Plan", plan?.id || crypto.randomUUID());
  }

  let needsMigration = false;
  const newSchedule: Partial<QuarterSchedule> = {};

  QUARTERS.forEach(qKey => {
    const oldQuarterData = plan.schedule[qKey];
    if (!oldQuarterData || !Array.isArray(oldQuarterData) || oldQuarterData.length !== PLAYERS_ON_COURT) {
      needsMigration = true;
      newSchedule[qKey] = Array(PLAYERS_ON_COURT).fill(null).map(() => []) as OnCourtPositions[typeof qKey];
      return;
    }

    newSchedule[qKey] = oldQuarterData.map((positionSegments: any[]) => {
      if (!Array.isArray(positionSegments)) {
        // If Firebase stored an array as an object {0: segA, 1: segB}, convert it
        if (typeof positionSegments === 'object' && positionSegments !== null) {
            needsMigration = true;
            positionSegments = Object.values(positionSegments);
        } else {
            needsMigration = true;
            return [];
        }
      }
      return positionSegments.map((segment: any) => {
        if (segment && typeof segment === 'object' && segment.playerId !== undefined && typeof segment.minutes === 'number') {
          if (!segment.id) {
            needsMigration = true;
            return { ...segment, id: crypto.randomUUID() };
          }
          return segment;
        }
        needsMigration = true;
        return null;
      }).filter(Boolean) as CourtPositionSegments;
    }) as OnCourtPositions[typeof qKey];
  });

  // Robust handling for plan.players from Firebase RTDB
  let rawPlayers = plan.players;
  let actualPlayersArray: Player[] = [];

  if (Array.isArray(rawPlayers)) {
    actualPlayersArray = rawPlayers;
  } else if (typeof rawPlayers === 'object' && rawPlayers !== null) {
    // Convert Firebase array-like object (e.g., {"0": playerA, "1": playerB}) to array
    actualPlayersArray = Object.values(rawPlayers);
    needsMigration = true; 
  } else if (rawPlayers === undefined || rawPlayers === null) {
    actualPlayersArray = [];
    if (plan.hasOwnProperty('players')) { // Only mark as migration if 'players' key existed but was null/undefined
        needsMigration = true;
    }
  } else {
    console.warn("Invalid plan.players structure, re-initializing players array:", rawPlayers);
    actualPlayersArray = [];
    needsMigration = true;
  }

  const finalPlayers = actualPlayersArray.map((p: any) => {
    if(p && typeof p.id === 'string' && typeof p.name === 'string') {
      // Ensure all expected fields are present, even if optional, to maintain consistent object shape
      return {
        id: p.id,
        name: p.name,
        jerseyNumber: p.jerseyNumber || "", // Ensure jerseyNumber is at least an empty string
        position: p.position || "",       // Ensure position is at least an empty string
      } as Player;
    }
    needsMigration = true; 
    return null;
  }).filter(Boolean) as Player[];


  if (needsMigration) {
     console.log("Migrating plan structure for plan ID:", plan.id, "Name:", plan.name);
     return { ...plan, id: String(plan.id), name: String(plan.name), players: finalPlayers, schedule: newSchedule as QuarterSchedule };
  }
  // Ensure id and name are strings even if no other migration happened
  return { ...plan, id: String(plan.id), name: String(plan.name) } as GamePlan;
};


export function useCourtCommander() {
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const currentPlan = useMemo(() => {
    if (!currentPlanId || gamePlans.length === 0) return null;
    return gamePlans.find(p => p.id === currentPlanId) || null;
  }, [gamePlans, currentPlanId]);

  useEffect(() => {
    setIsLoading(true);
    const gamePlansRef = ref(db, GAME_PLANS_PATH);
    
    const unsubscribe = onValue(gamePlansRef, async (snapshot) => {
      const data = snapshot.val();
      let loadedPlans: GamePlan[] = [];

      if (data) {
        loadedPlans = Object.keys(data).map(key => migratePlanStructure({ ...data[key], id: key }));
      }
      
      setGamePlans(loadedPlans);

      if (loadedPlans.length === 0) {
        const initialPlan = createNewGamePlanObject("Default Plan");
        try {
          await set(ref(db, `${GAME_PLANS_PATH}/${initialPlan.id}`), initialPlan);
          // onValue will pick this up and setGamePlans, which will trigger currentPlanId logic below
          console.log("Created initial default plan in Realtime Database.");
          // setCurrentPlanId(initialPlan.id); // This will be handled by the next onValue trigger
        } catch (error) {
          console.error("Failed to create initial plan:", error);
          toast({ title: "Error", description: "Could not create initial game plan.", variant: "destructive"});
        }
      } else if (!currentPlanId || !loadedPlans.some(p => p.id === currentPlanId)) {
         // If currentPlanId is invalid or not set, default to the first loaded plan
        setCurrentPlanId(loadedPlans[0].id);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching game plans from Realtime Database:", error);
      toast({ title: "Database Error", description: "Could not connect to the Realtime Database.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentPlanId, toast]); // Added currentPlanId to dependency array

  const savePlanToDatabase = useCallback(async (plan: GamePlan) => {
    if (!plan.id) {
      console.error("Plan must have an ID to be saved.");
      toast({ title: "Error", description: "Plan has no ID.", variant: "destructive"});
      return;
    }
    try {
      await set(ref(db, `${GAME_PLANS_PATH}/${plan.id}`), plan);
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
    // Ensure currentPlan.players is an array
    const playersArray = Array.isArray(currentPlan.players) ? currentPlan.players : [];
    const updatedPlayers = [...playersArray, player];
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    await savePlanToDatabase(updatedPlan);
    toast({ title: "Player Added", description: `${player.name} has been added.` });
  }, [currentPlan, savePlanToDatabase, toast]);

  const editPlayer = useCallback(async (updatedPlayer: Player) => {
    if (!currentPlan) return;
    const playersArray = Array.isArray(currentPlan.players) ? currentPlan.players : [];
    const updatedPlayers = playersArray.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    await savePlanToDatabase(updatedPlan);
    toast({ title: "Player Updated", description: `${updatedPlayer.name}'s details have been updated.` });
  }, [currentPlan, savePlanToDatabase, toast]);

  const deletePlayer = useCallback(async (playerId: string) => {
    if (!currentPlan) return;
    const playersArray = Array.isArray(currentPlan.players) ? currentPlan.players : [];
    const playerToRemove = playersArray.find(p => p.id === playerId);
    const updatedPlayers = playersArray.filter(p => p.id !== playerId);
    
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    QUARTERS.forEach(qKey => {
      newSchedule[qKey].forEach((positionSegments, posIdx) => {
        // Ensure positionSegments is an array before filtering
        const segmentsArray = Array.isArray(newSchedule[qKey][posIdx]) ? newSchedule[qKey][posIdx] : Object.values(newSchedule[qKey][posIdx] || {});
        newSchedule[qKey][posIdx] = segmentsArray.filter(segment => segment.playerId !== playerId);
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

    // Helper to ensure a position in the schedule is an array
    const ensureArray = (quarter: QuarterKey, posIdx: number) => {
        if (!Array.isArray(newSchedule[quarter][posIdx])) {
            newSchedule[quarter][posIdx] = Object.values(newSchedule[quarter][posIdx] || {}) as CourtPositionSegments;
        }
    };
    
    QUARTERS.forEach(q => {
        for (let i = 0; i < PLAYERS_ON_COURT; i++) {
            ensureArray(q, i);
        }
    });


    if (draggedInfo.sourceType === 'timeline' && draggedInfo.sourceQuarter && typeof draggedInfo.sourcePositionIndex === 'number' && draggedInfo.sourceSegmentId) {
      ensureArray(draggedInfo.sourceQuarter, draggedInfo.sourcePositionIndex);
      const sourceSegments = newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex];
      newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex] = sourceSegments.filter(
        (segment) => segment.id !== draggedInfo.sourceSegmentId
      );
    }
    
    if (!(draggedInfo.sourceType === 'timeline' && draggedInfo.sourceQuarter === targetQuarter && draggedInfo.sourcePositionIndex === targetPositionIndex)) {
       newSchedule[targetQuarter].forEach((_, posIdx) => {
        ensureArray(targetQuarter, posIdx);
        if (posIdx !== targetPositionIndex) { 
          newSchedule[targetQuarter][posIdx] = newSchedule[targetQuarter][posIdx].filter(segment => segment.playerId !== playerId);
        }
      });
    }

    ensureArray(targetQuarter, targetPositionIndex);
    const targetPositionSegments = newSchedule[targetQuarter][targetPositionIndex];
    const newSegment: PlayerTimeSegment = {
      id: crypto.randomUUID(),
      playerId,
      minutes: targetPositionSegments.length === 0 ? QUARTER_DURATION_MINUTES : 6, // Default minutes
    };
    targetPositionSegments.push(newSegment);
    // newSchedule[targetQuarter][targetPositionIndex] = targetPositionSegments; // Already a reference

    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    await savePlanToDatabase(updatedPlan);
  }, [currentPlan, savePlanToDatabase]);

  const unassignPlayerSegment = useCallback(async (quarter: QuarterKey, positionIndex: number, segmentId: string) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    
    const ensureArray = (q: QuarterKey, pIndex: number) => {
        if (!Array.isArray(newSchedule[q][pIndex])) {
            newSchedule[q][pIndex] = Object.values(newSchedule[q][pIndex] || {}) as CourtPositionSegments;
        }
    };
    ensureArray(quarter, positionIndex);

    const positionSegments = newSchedule[quarter][positionIndex];
    newSchedule[quarter][positionIndex] = positionSegments.filter(segment => segment.id !== segmentId);
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    await savePlanToDatabase(updatedPlan);
  }, [currentPlan, savePlanToDatabase]);

  const updatePlayerMinutesInSegment = useCallback(async (quarterKey: QuarterKey, positionIndex: number, segmentId: string, minutes: number) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;

    const ensureArray = (q: QuarterKey, pIndex: number) => {
        if (!Array.isArray(newSchedule[q][pIndex])) {
            newSchedule[q][pIndex] = Object.values(newSchedule[q][pIndex] || {}) as CourtPositionSegments;
        }
    };
    ensureArray(quarterKey, positionIndex);

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
      // newSchedule[quarterKey][positionIndex] = positionSegments; // Already a reference
      const updatedPlan = { ...currentPlan, schedule: newSchedule };
      await savePlanToDatabase(updatedPlan);
    }
  }, [currentPlan, savePlanToDatabase, toast]);

  const saveCurrentGamePlanAs = useCallback(async (name: string) => {
    if (!currentPlan) return;
    const newPlanId = crypto.randomUUID();
    // Create a deep copy of currentPlan to avoid modifying the original state object directly
    // especially its 'players' and 'schedule' arrays/objects.
    const planToSave = JSON.parse(JSON.stringify(currentPlan));
    const newPlan = { ...planToSave, name: name, id: newPlanId };
    
    await set(ref(db, `${GAME_PLANS_PATH}/${newPlanId}`), newPlan);
    setCurrentPlanId(newPlanId); // This will trigger onValue listener which updates gamePlans
    toast({ title: "Game Plan Saved As", description: `"${name}" has been saved.` });
  }, [currentPlan, toast]); // Removed setCurrentPlanId from deps as it's a state setter
  
  const updateGamePlanName = useCallback(async (planId: string, newName: string) => {
    const planToUpdate = gamePlans.find(p => p.id === planId);
    if (planToUpdate) {
      const updatedRenamedPlan = { ...planToUpdate, name: newName };
      await savePlanToDatabase(updatedRenamedPlan);
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
  }, [gamePlans, toast]); // Removed setCurrentPlanId from deps

  const createAndLoadNewGamePlan = useCallback(async () => {
    const newPlanName = `Game Plan ${gamePlans.length + 1}`;
    const newPlanInstance = createNewGamePlanObject(newPlanName);
    try {
      await set(ref(db, `${GAME_PLANS_PATH}/${newPlanInstance.id}`), newPlanInstance);
      // Setting currentPlanId here will cause onValue to run and load it correctly.
      setCurrentPlanId(newPlanInstance.id); 
      toast({ title: "New Plan Created", description: `"${newPlanName}" is ready.` });
    } catch (error) {
      console.error("Error creating new plan in Realtime Database:", error);
      toast({ title: "Error", description: "Could not create new plan.", variant: "destructive"});
    }
  }, [gamePlans.length, toast]); // Removed setCurrentPlanId from deps

  const deleteGamePlan = useCallback(async (planId: string) => {
    if (gamePlans.length <= 1) {
      toast({ title: "Cannot Delete", description: "You must have at least one game plan.", variant: "destructive" });
      return;
    }
    const planToDelete = gamePlans.find(p => p.id === planId);
    try {
      await remove(ref(db, `${GAME_PLANS_PATH}/${planId}`));
      // If the deleted plan was current, onValue's logic will pick a new current plan.
      toast({ title: "Plan Deleted", description: `"${planToDelete?.name || 'Plan'}" deleted.`});
       if (currentPlanId === planId) {
        // Explicitly set currentPlanId to null, onValue will then pick the first available
        setCurrentPlanId(null); 
      }
    } catch (error) {
      console.error("Error deleting plan from Realtime Database:", error);
      toast({ title: "Error", description: "Could not delete plan.", variant: "destructive" });
    }
  }, [gamePlans, currentPlanId, toast]); // Added currentPlanId and removed setCurrentPlanId

  const getPlayerTotalTime = useCallback((playerId: string): number => {
    if (!currentPlan?.schedule) return 0;
    let totalMinutes = 0;
    QUARTERS.forEach(qKey => {
      // Ensure currentPlan.schedule[qKey] is an array of arrays (positions)
      const positionsInQuarter = Array.isArray(currentPlan.schedule[qKey]) 
        ? currentPlan.schedule[qKey] 
        : Object.values(currentPlan.schedule[qKey] || {});

      positionsInQuarter.forEach(positionSegmentsObj => {
        // Ensure positionSegmentsObj is an array of segments
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
    players: currentPlan?.players ? (Array.isArray(currentPlan.players) ? currentPlan.players : Object.values(currentPlan.players)) : [],
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

