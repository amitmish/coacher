
"use client";

import type { Player, GamePlan, QuarterSchedule, QuarterKey, OnCourtPlayerSlots, PlayerTimeSlot, DraggedPlayerInfo } from "@/lib/types";
import { QUARTERS, PLAYERS_ON_COURT, QUARTER_DURATION_MINUTES } from "@/lib/types";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY_PLANS = "courtCommanderGamePlans";
const LOCAL_STORAGE_KEY_CURRENT_PLAN_ID = "courtCommanderCurrentPlanId";

const createEmptySchedule = (): QuarterSchedule => {
  const emptySlot = (): PlayerTimeSlot => ({ playerId: null, minutes: 0 });
  return {
    Q1: Array(PLAYERS_ON_COURT).fill(null).map(emptySlot) as OnCourtPlayerSlots,
    Q2: Array(PLAYERS_ON_COURT).fill(null).map(emptySlot) as OnCourtPlayerSlots,
    Q3: Array(PLAYERS_ON_COURT).fill(null).map(emptySlot) as OnCourtPlayerSlots,
    Q4: Array(PLAYERS_ON_COURT).fill(null).map(emptySlot) as OnCourtPlayerSlots,
  };
};

const createNewGamePlan = (name: string = "New Game Plan"): GamePlan => ({
  id: crypto.randomUUID(),
  name,
  players: [],
  schedule: createEmptySchedule(),
});

// Migration function for localStorage data
const migratePlanStructure = (plan: any): GamePlan => {
  let needsMigration = false;
  if (plan && plan.schedule) {
    for (const qKey of QUARTERS) {
      if (plan.schedule[qKey] && plan.schedule[qKey].length > 0) {
        const firstSlot = plan.schedule[qKey][0];
        if (typeof firstSlot !== 'object' || firstSlot === null || !('minutes' in firstSlot) || !('playerId' in firstSlot)) {
          needsMigration = true;
          break;
        }
      } else {
        // If a quarter is missing or empty, it needs re-initialization
        needsMigration = true;
        break;
      }
    }
  } else {
    // If schedule is missing entirely
    needsMigration = true;
  }

  if (needsMigration) {
    const migratedSchedule: Partial<QuarterSchedule> = {};
    QUARTERS.forEach(qKey => {
      const oldQuarterSlots = plan.schedule?.[qKey];
      if (Array.isArray(oldQuarterSlots) && oldQuarterSlots.length === PLAYERS_ON_COURT) {
        migratedSchedule[qKey] = oldQuarterSlots.map((slot: any) => {
          if (typeof slot === 'string' || slot === null) { // Old format: string or null
            return { playerId: slot, minutes: slot ? QUARTER_DURATION_MINUTES : 0 };
          }
          // If it's already an object, ensure it has the right properties
          return {
            playerId: slot.playerId || null,
            minutes: typeof slot.minutes === 'number' ? slot.minutes : (slot.playerId ? QUARTER_DURATION_MINUTES : 0),
          };
        }) as OnCourtPlayerSlots;
      } else {
        // Fallback: initialize quarter correctly
        migratedSchedule[qKey] = Array(PLAYERS_ON_COURT).fill(null).map(() => ({ playerId: null, minutes: 0 })) as OnCourtPlayerSlots;
      }
    });
    return { ...plan, schedule: migratedSchedule as QuarterSchedule };
  }
  return plan as GamePlan; // Assume it's already in the correct new format
};


export function useCourtCommander() {
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<GamePlan>(createNewGamePlan());
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedPlans = localStorage.getItem(LOCAL_STORAGE_KEY_PLANS);
      const storedCurrentPlanId = localStorage.getItem(LOCAL_STORAGE_KEY_CURRENT_PLAN_ID);
      
      const rawLoadedPlans: any[] = storedPlans ? JSON.parse(storedPlans) : [];
      const loadedPlans: GamePlan[] = rawLoadedPlans.map(migratePlanStructure).filter(p => p && p.id && p.name);

      setGamePlans(loadedPlans);

      if (loadedPlans.length > 0) {
        const planToLoad = storedCurrentPlanId 
          ? loadedPlans.find(p => p.id === storedCurrentPlanId) 
          : loadedPlans[0];
        setCurrentPlan(planToLoad || loadedPlans[0] || createNewGamePlan("Default Plan"));
      } else {
        const initialPlan = createNewGamePlan("Default Plan");
        setCurrentPlan(initialPlan);
        setGamePlans([initialPlan]);
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      toast({ title: "Error", description: "Could not load saved data. Resetting to default.", variant: "destructive" });
      const initialPlan = createNewGamePlan("Default Plan");
      setCurrentPlan(initialPlan);
      setGamePlans([initialPlan]);
    }
  }, [toast]);
  
  useEffect(() => {
    if (gamePlans.length > 0) { // Only save if there's something to save
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(gamePlans));
            if (currentPlan && currentPlan.id) {
                localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_PLAN_ID, currentPlan.id);
            }
        } catch (error) {
            console.error("Failed to save to localStorage:", error);
            toast({ title: "Error", description: "Could not save data.", variant: "destructive" });
        }
    }
  }, [gamePlans, currentPlan, toast]);
  
  const updateCurrentPlan = useCallback((updatedPlan: GamePlan) => {
    setCurrentPlan(updatedPlan);
    setGamePlans(prevPlans => 
      prevPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
    );
  }, []);

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
      newSchedule[qKey] = newSchedule[qKey].map(slot => 
        slot.playerId === playerId ? { playerId: null, minutes: 0 } : slot
      ) as OnCourtPlayerSlots;
    });
    const updatedPlan = { ...currentPlan, players: updatedPlayers, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
    toast({ title: "Player Deleted", description: `${playerToRemove?.name || 'Player'} has been removed.` });
  }, [currentPlan, updateCurrentPlan, toast]);

  const assignPlayerToSlot = useCallback((
    playerId: string, 
    targetQuarter: QuarterKey, 
    targetSlotIndex: number,
    sourceQuarter?: QuarterKey,
    sourceSlotIndex?: number
  ) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;

    if (sourceQuarter !== undefined && sourceSlotIndex !== undefined) {
        if (newSchedule[sourceQuarter][sourceSlotIndex].playerId === playerId) {
            newSchedule[sourceQuarter][sourceSlotIndex] = { playerId: null, minutes: 0 };
        }
    }

    newSchedule[targetQuarter] = newSchedule[targetQuarter].map((slot, index) => {
        if (slot.playerId === playerId && index !== targetSlotIndex) {
            return { playerId: null, minutes: 0 };
        }
        return slot;
    }) as OnCourtPlayerSlots;

    newSchedule[targetQuarter][targetSlotIndex] = { playerId, minutes: QUARTER_DURATION_MINUTES };
    
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
  }, [currentPlan, updateCurrentPlan]);

  const unassignPlayerFromSlot = useCallback((quarter: QuarterKey, slotIndex: number) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    newSchedule[quarter][slotIndex] = { playerId: null, minutes: 0 };
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
  }, [currentPlan, updateCurrentPlan]);

  const updatePlayerMinutesInSlot = useCallback((quarterKey: QuarterKey, slotIndex: number, minutes: number) => {
    if (!currentPlan) return;
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)) as QuarterSchedule;
    if (newSchedule[quarterKey] && newSchedule[quarterKey][slotIndex]) {
      const validatedMinutes = Math.max(0, Math.min(minutes, QUARTER_DURATION_MINUTES));
      newSchedule[quarterKey][slotIndex].minutes = validatedMinutes;
      const updatedPlan = { ...currentPlan, schedule: newSchedule };
      updateCurrentPlan(updatedPlan);
    }
  }, [currentPlan, updateCurrentPlan]);

  const saveCurrentGamePlanAs = useCallback((name: string) => {
    if (!currentPlan) return;
    const newPlan = { ...currentPlan, name: name, id: crypto.randomUUID() };
    setGamePlans(prev => [...prev, newPlan]);
    setCurrentPlan(newPlan); // setCurrentPlan also triggers save through useEffect
    toast({ title: "Game Plan Saved", description: `"${name}" has been saved.` });
  }, [currentPlan, toast]);
  
  const updateGamePlanName = useCallback((planId: string, newName: string) => {
    const planToUpdate = gamePlans.find(p => p.id === planId);
    if (planToUpdate) {
      const updatedPlan = { ...planToUpdate, name: newName };
      if (currentPlan && currentPlan.id === planId) {
        setCurrentPlan(updatedPlan);
      }
      setGamePlans(prevPlans => prevPlans.map(p => p.id === planId ? updatedPlan : p));
      toast({ title: "Plan Renamed", description: `Plan renamed to "${newName}".` });
    }
  }, [gamePlans, currentPlan, toast]);

  const loadGamePlan = useCallback((planId: string) => {
    const planToLoad = gamePlans.find(p => p.id === planId);
    if (planToLoad) {
      setCurrentPlan(planToLoad); // This also triggers save of currentPlanId through useEffect
      toast({ title: "Game Plan Loaded", description: `"${planToLoad.name}" has been loaded.` });
    } else {
      toast({ title: "Error", description: "Could not find game plan to load.", variant: "destructive" });
    }
  }, [gamePlans, toast]);

  const createAndLoadNewGamePlan = useCallback(() => {
    const newPlanName = `Game Plan ${gamePlans.length + 1}`;
    const newPlan = createNewGamePlan(newPlanName);
    setGamePlans(prev => [...prev, newPlan]);
    setCurrentPlan(newPlan); // This also triggers save through useEffect
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
      setCurrentPlan(remainingPlans[0] || createNewGamePlan("Default Plan"));
    }
    toast({ title: "Plan Deleted", description: `"${planToDelete?.name || 'Plan'}" deleted.`});
  }, [gamePlans, currentPlan, toast]);

  const getPlayerTotalTime = useCallback((playerId: string): number => {
    if (!currentPlan?.schedule) return 0;
    let totalMinutes = 0;
    QUARTERS.forEach(qKey => {
      currentPlan.schedule[qKey].forEach(slot => {
        if (slot.playerId === playerId) {
          totalMinutes += slot.minutes;
        }
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
    assignPlayerToSlot,
    unassignPlayerFromSlot,
    updatePlayerMinutesInSlot,
    getPlayerTotalTime,
    saveCurrentGamePlanAs,
    updateGamePlanName,
    loadGamePlan,
    createAndLoadNewGamePlan,
    deleteGamePlan,
  };
}
