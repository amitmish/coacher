
"use client";

import type { Player, GamePlan, QuarterSchedule, QuarterKey, OnCourtPositions, PlayerTimeSegment, DraggedPlayerInfo, CourtPositionSegments } from "@/lib/types";
import { QUARTERS, PLAYERS_ON_COURT, QUARTER_DURATION_MINUTES } from "@/lib/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase"; // Firebase Firestore instance
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  Timestamp, // Import Timestamp if you plan to use server timestamps
} from "firebase/firestore";

const GAME_PLANS_COLLECTION = "gamePlans";

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

// Migration logic (can be simplified or removed if Firestore data is always written correctly)
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
        needsMigration = true;
        return []; // Malformed, reset to empty segments for this position
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

  const finalPlayers = Array.isArray(plan.players) ? plan.players.map((p: any) => {
    if(p && p.id && p.name) return p;
    needsMigration = true;
    return null;
  }).filter(Boolean) : (needsMigration = true, []);


  if (needsMigration) {
     console.log("Migrating plan structure for:", plan.name);
     return { ...plan, players: finalPlayers, schedule: newSchedule as QuarterSchedule };
  }
  return plan as GamePlan;
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
    const q = query(collection(db, GAME_PLANS_COLLECTION));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let loadedPlans = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as GamePlan));
      
      // Apply migration to ensure data structure is consistent
      loadedPlans = loadedPlans.map(migratePlanStructure);

      setGamePlans(loadedPlans);

      if (loadedPlans.length === 0) {
        // No plans in Firestore. Create and save a default one.
        const initialPlan = createNewGamePlanObject("Default Plan");
        try {
          await setDoc(doc(db, GAME_PLANS_COLLECTION, initialPlan.id), initialPlan);
          // onSnapshot will pick this up and setGamePlans, and then the below logic will set currentPlanId
          // setCurrentPlanId(initialPlan.id); // Let onSnapshot handle setting this to avoid race conditions
          console.log("Created initial default plan in Firestore.");
        } catch (error) {
          console.error("Failed to create initial plan:", error);
          toast({ title: "Error", description: "Could not create initial game plan.", variant: "destructive"});
        }
      } else if (!currentPlanId || !loadedPlans.some(p => p.id === currentPlanId)) {
        // Current plan ID is not set, or the current plan was deleted. Set to first available.
        setCurrentPlanId(loadedPlans[0].id);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching game plans from Firestore:", error);
      toast({ title: "Database Error", description: "Could not connect to the database. Please check your Firebase setup and internet connection.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]); // Removed currentPlanId from deps, onSnapshot handles it

  const savePlanToFirestore = useCallback(async (plan: GamePlan) => {
    if (!plan.id) {
      console.error("Plan must have an ID to be saved to Firestore.");
      toast({ title: "Error", description: "Plan has no ID.", variant: "destructive"});
      return;
    }
    try {
      await setDoc(doc(db, GAME_PLANS_COLLECTION, plan.id), plan);
    } catch (error) {
      console.error("Error saving plan to Firestore:", error);
      toast({ title: "Save Error", description: "Could not save plan to database.", variant: "destructive" });
    }
  }, [toast]);

  const addPlayer = useCallback(async (player: Player) => {
    if (!currentPlan) return;
    const updatedPlayers = [...currentPlan.players, player];
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    await savePlanToFirestore(updatedPlan);
    toast({ title: "Player Added", description: `${player.name} has been added.` });
  }, [currentPlan, savePlanToFirestore, toast]);

  const editPlayer = useCallback(async (updatedPlayer: Player) => {
    if (!currentPlan) return;
    const updatedPlayers = currentPlan.players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    await savePlanToFirestore(updatedPlan);
    toast({ title: "Player Updated", description: `${updatedPlayer.name}'s details have been updated.` });
  }, [currentPlan, savePlanToFirestore, toast]);

  const deletePlayer = useCallback(async (playerId: string) => {
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
    await savePlanToFirestore(updatedPlan);
    toast({ title: "Player Deleted", description: `${playerToRemove?.name || 'Player'} has been removed and unassigned.` });
  }, [currentPlan, savePlanToFirestore, toast]);

 const assignPlayerToPosition = useCallback(async (
    playerId: string,
    targetQuarter: QuarterKey,
    targetPositionIndex: number,
    draggedInfo: DraggedPlayerInfo
  ) => {
    if (!currentPlan) return;
    let newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;

    if (draggedInfo.sourceType === 'timeline' && draggedInfo.sourceQuarter && draggedInfo.sourcePositionIndex !== undefined && draggedInfo.sourceSegmentId) {
      const sourceSegments = newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex];
      newSchedule[draggedInfo.sourceQuarter][draggedInfo.sourcePositionIndex] = sourceSegments.filter(
        (segment) => segment.id !== draggedInfo.sourceSegmentId
      );
    }

    QUARTERS.forEach(qKey => {
        if (qKey === targetQuarter) {
            newSchedule[qKey].forEach((positionSegments, posIdx) => {
                if (posIdx !== targetPositionIndex || draggedInfo.sourcePositionIndex !== targetPositionIndex || draggedInfo.sourceQuarter !== targetQuarter) {
                    newSchedule[qKey][posIdx] = positionSegments.filter(segment => segment.playerId !== playerId);
                }
            });
        }
    });

    const targetPositionSegments = newSchedule[targetQuarter][targetPositionIndex];
    const newSegment: PlayerTimeSegment = {
      id: crypto.randomUUID(),
      playerId,
      minutes: targetPositionSegments.length === 0 ? QUARTER_DURATION_MINUTES : 6, // Default to 6 or full if first
    };
    targetPositionSegments.push(newSegment);
    newSchedule[targetQuarter][targetPositionIndex] = targetPositionSegments;

    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    await savePlanToFirestore(updatedPlan);
  }, [currentPlan, savePlanToFirestore]);

  const unassignPlayerSegment = useCallback(async (quarter: QuarterKey, positionIndex: number, segmentId: string) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    const positionSegments = newSchedule[quarter][positionIndex];
    newSchedule[quarter][positionIndex] = positionSegments.filter(segment => segment.id !== segmentId);
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    await savePlanToFirestore(updatedPlan);
  }, [currentPlan, savePlanToFirestore]);

  const updatePlayerMinutesInSegment = useCallback(async (quarterKey: QuarterKey, positionIndex: number, segmentId: string, minutes: number) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
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
      newSchedule[quarterKey][positionIndex] = positionSegments;
      const updatedPlan = { ...currentPlan, schedule: newSchedule };
      await savePlanToFirestore(updatedPlan);
    }
  }, [currentPlan, savePlanToFirestore, toast]);

  const saveCurrentGamePlanAs = useCallback(async (name: string) => {
    if (!currentPlan) return;
    const newPlanId = crypto.randomUUID();
    const newPlan = { ...currentPlan, name: name, id: newPlanId }; // Ensure new ID
    await setDoc(doc(db, GAME_PLANS_COLLECTION, newPlanId), newPlan); // Use setDoc with new ID
    setCurrentPlanId(newPlanId); // Switch to the new plan
    toast({ title: "Game Plan Saved As", description: `"${name}" has been saved.` });
  }, [currentPlan, toast]);
  
  const updateGamePlanName = useCallback(async (planId: string, newName: string) => {
    const planToUpdate = gamePlans.find(p => p.id === planId);
    if (planToUpdate) {
      const updatedRenamedPlan = { ...planToUpdate, name: newName };
      await savePlanToFirestore(updatedRenamedPlan);
      // onSnapshot will update currentPlan if it's the one being renamed
      toast({ title: "Plan Renamed", description: `Plan renamed to "${newName}".` });
    }
  }, [gamePlans, savePlanToFirestore, toast]);

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
    const newPlanName = `Game Plan ${gamePlans.length + 1}`; // Name can be improved
    const newPlanInstance = createNewGamePlanObject(newPlanName);
    try {
      await setDoc(doc(db, GAME_PLANS_COLLECTION, newPlanInstance.id), newPlanInstance);
      setCurrentPlanId(newPlanInstance.id); // onSnapshot will eventually list it, this makes it active faster
      toast({ title: "New Plan Created", description: `"${newPlanName}" is ready.` });
    } catch (error) {
      console.error("Error creating new plan in Firestore:", error);
      toast({ title: "Error", description: "Could not create new plan.", variant: "destructive"});
    }
  }, [gamePlans.length, toast]);

  const deleteGamePlan = useCallback(async (planId: string) => {
    if (gamePlans.length <= 1) {
      toast({ title: "Cannot Delete", description: "You must have at least one game plan.", variant: "destructive" });
      return;
    }
    const planToDelete = gamePlans.find(p => p.id === planId);
    try {
      await deleteDoc(doc(db, GAME_PLANS_COLLECTION, planId));
      // If the deleted plan was the current one, onSnapshot's logic will pick a new current plan.
      toast({ title: "Plan Deleted", description: `"${planToDelete?.name || 'Plan'}" deleted.`});
    } catch (error) {
      console.error("Error deleting plan from Firestore:", error);
      toast({ title: "Error", description: "Could not delete plan.", variant: "destructive" });
    }
  }, [gamePlans, toast]);

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
    currentPlan, // This is now derived via useMemo
    isLoading, // Expose loading state
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
