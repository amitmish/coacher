"use client";

import type { Player, GamePlan, QuarterSchedule, QuarterKey, OnCourtPlayers, DraggedPlayerInfo } from "@/lib/types";
import { QUARTERS, PLAYERS_ON_COURT, QUARTER_DURATION_MINUTES } from "@/lib/types";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

const LOCAL_STORAGE_KEY_PLANS = "courtCommanderGamePlans";
const LOCAL_STORAGE_KEY_CURRENT_PLAN_ID = "courtCommanderCurrentPlanId";

const createEmptySchedule = (): QuarterSchedule => ({
  Q1: Array(PLAYERS_ON_COURT).fill(null) as OnCourtPlayers,
  Q2: Array(PLAYERS_ON_COURT).fill(null) as OnCourtPlayers,
  Q3: Array(PLAYERS_ON_COURT).fill(null) as OnCourtPlayers,
  Q4: Array(PLAYERS_ON_COURT).fill(null) as OnCourtPlayers,
});

const createNewGamePlan = (name: string = "New Game Plan"): GamePlan => ({
  id: crypto.randomUUID(),
  name,
  players: [],
  schedule: createEmptySchedule(),
});

export function useCourtCommander() {
  const [gamePlans, setGamePlans] = useState<GamePlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<GamePlan>(createNewGamePlan());
  const { toast } = useToast();

  // Load from localStorage on initial mount
  useEffect(() => {
    try {
      const storedPlans = localStorage.getItem(LOCAL_STORAGE_KEY_PLANS);
      const storedCurrentPlanId = localStorage.getItem(LOCAL_STORAGE_KEY_CURRENT_PLAN_ID);
      
      const loadedPlans: GamePlan[] = storedPlans ? JSON.parse(storedPlans) : [];
      setGamePlans(loadedPlans);

      if (loadedPlans.length > 0) {
        const planToLoad = storedCurrentPlanId 
          ? loadedPlans.find(p => p.id === storedCurrentPlanId) 
          : loadedPlans[0];
        setCurrentPlan(planToLoad || loadedPlans[0]);
      } else {
        // If no plans, ensure currentPlan is a new one and save it
        const initialPlan = createNewGamePlan("Default Plan");
        setCurrentPlan(initialPlan);
        setGamePlans([initialPlan]);
        localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify([initialPlan]));
        localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_PLAN_ID, initialPlan.id);
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      toast({ title: "Error", description: "Could not load saved data.", variant: "destructive" });
      // Fallback to a new default plan
      const initialPlan = createNewGamePlan("Default Plan");
      setCurrentPlan(initialPlan);
      setGamePlans([initialPlan]);
    }
  }, [toast]);

  // Save to localStorage whenever gamePlans or currentPlan.id changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(gamePlans));
      if (currentPlan) {
        localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_PLAN_ID, currentPlan.id);
      }
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
      toast({ title: "Error", description: "Could not save data.", variant: "destructive" });
    }
  }, [gamePlans, currentPlan?.id, toast]);
  
  const updateCurrentPlan = useCallback((updatedPlan: GamePlan) => {
    setCurrentPlan(updatedPlan);
    setGamePlans(prevPlans => 
      prevPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p)
    );
  }, []);

  // Player Management
  const addPlayer = useCallback((player: Player) => {
    const updatedPlan = { ...currentPlan, players: [...currentPlan.players, player] };
    updateCurrentPlan(updatedPlan);
    toast({ title: "Player Added", description: `${player.name} has been added.` });
  }, [currentPlan, updateCurrentPlan, toast]);

  const editPlayer = useCallback((updatedPlayer: Player) => {
    const updatedPlayers = currentPlan.players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
    const updatedPlan = { ...currentPlan, players: updatedPlayers };
    updateCurrentPlan(updatedPlan);
    toast({ title: "Player Updated", description: `${updatedPlayer.name}'s details have been updated.` });
  }, [currentPlan, updateCurrentPlan, toast]);

  const deletePlayer = useCallback((playerId: string) => {
    const playerToRemove = currentPlan.players.find(p => p.id === playerId);
    const updatedPlayers = currentPlan.players.filter(p => p.id !== playerId);
    // Also remove player from schedule
    const newSchedule = { ...currentPlan.schedule };
    QUARTERS.forEach(qKey => {
      newSchedule[qKey] = newSchedule[qKey].map(pId => pId === playerId ? null : pId) as OnCourtPlayers;
    });
    const updatedPlan = { ...currentPlan, players: updatedPlayers, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
    toast({ title: "Player Deleted", description: `${playerToRemove?.name || 'Player'} has been removed.` });
  }, [currentPlan, updateCurrentPlan, toast]);


  // Schedule Management
  const assignPlayerToSlot = useCallback((
    playerId: string, 
    targetQuarter: QuarterKey, 
    targetSlotIndex: number,
    sourceQuarter?: QuarterKey,
    sourceSlotIndex?: number
  ) => {
    const newSchedule = JSON.parse(JSON.stringify(currentPlan.schedule)); // Deep copy

    // If player already in this exact slot, do nothing (or treat as unassign)
    if (newSchedule[targetQuarter][targetSlotIndex] === playerId) {
        // Optional: unassign if dragged to same spot? For now, no change.
        return;
    }
    
    // Clear player from old slot if they were moved from another slot on the timeline
    if (sourceQuarter !== undefined && sourceSlotIndex !== undefined) {
        if (newSchedule[sourceQuarter][sourceSlotIndex] === playerId) {
            newSchedule[sourceQuarter][sourceSlotIndex] = null;
        }
    }

    // If target slot is occupied by another player, that player is benched (removed from this slot)
    // Player being moved might also be on court elsewhere in the same quarter, remove them.
    newSchedule[targetQuarter] = newSchedule[targetQuarter].map((p: string | null, index: number) => {
        if (p === playerId && index !== targetSlotIndex) return null; // Remove from other slots in same quarter
        return p;
    }) as OnCourtPlayers;

    newSchedule[targetQuarter][targetSlotIndex] = playerId;
    
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
  }, [currentPlan, updateCurrentPlan]);


  const unassignPlayerFromSlot = useCallback((quarter: QuarterKey, slotIndex: number) => {
    const newSchedule = { ...currentPlan.schedule };
    const currentQuarterSchedule = [...newSchedule[quarter]] as OnCourtPlayers;
    currentQuarterSchedule[slotIndex] = null;
    newSchedule[quarter] = currentQuarterSchedule;
    const updatedPlan = { ...currentPlan, schedule: newSchedule };
    updateCurrentPlan(updatedPlan);
  }, [currentPlan, updateCurrentPlan]);

  // Game Plan Management
  const saveCurrentGamePlanAs = useCallback((name: string) => {
    const newPlan = { ...currentPlan, name: name, id: crypto.randomUUID() }; // new ID if "save as"
    setGamePlans(prev => [...prev, newPlan]);
    setCurrentPlan(newPlan);
    toast({ title: "Game Plan Saved", description: `"${name}" has been saved.` });
  }, [currentPlan, toast]);
  
  const updateGamePlanName = useCallback((planId: string, newName: string) => {
    const planToUpdate = gamePlans.find(p => p.id === planId);
    if (planToUpdate) {
      const updatedPlan = { ...planToUpdate, name: newName };
      if (currentPlan.id === planId) {
        setCurrentPlan(updatedPlan);
      }
      setGamePlans(prevPlans => prevPlans.map(p => p.id === planId ? updatedPlan : p));
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
    const newPlan = createNewGamePlan(newPlanName);
    setGamePlans(prev => [...prev, newPlan]);
    setCurrentPlan(newPlan);
    toast({ title: "New Plan Created", description: `"${newPlanName}" is ready.` });
  }, [gamePlans, toast]);

  const deleteGamePlan = useCallback((planId: string) => {
    if (gamePlans.length <= 1) {
      toast({ title: "Cannot Delete", description: "You must have at least one game plan.", variant: "destructive" });
      return;
    }
    const planToDelete = gamePlans.find(p => p.id === planId);
    setGamePlans(prev => prev.filter(p => p.id !== planId));
    if (currentPlan.id === planId) {
      // Load another plan, e.g., the first one
      const remainingPlans = gamePlans.filter(p => p.id !== planId);
      setCurrentPlan(remainingPlans[0] || createNewGamePlan("Default Plan"));
    }
    toast({ title: "Plan Deleted", description: `"${planToDelete?.name}" deleted.`});
  }, [gamePlans, currentPlan, toast]);


  // Playing Time Calculation
  const getPlayerTotalTime = useCallback((playerId: string): number => {
    if (!currentPlan?.schedule) return 0;
    let quartersPlayed = 0;
    QUARTERS.forEach(qKey => {
      if (currentPlan.schedule[qKey].includes(playerId)) {
        quartersPlayed++;
      }
    });
    return quartersPlayed * QUARTER_DURATION_MINUTES;
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
    getPlayerTotalTime,
    saveCurrentGamePlanAs,
    updateGamePlanName,
    loadGamePlan,
    createAndLoadNewGamePlan,
    deleteGamePlan,
  };
}
