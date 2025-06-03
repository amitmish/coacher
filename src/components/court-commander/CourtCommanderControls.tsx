"use client";

import type { GamePlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, FolderOpen, PlusSquare, Printer, Trash2, Edit } from "lucide-react";
import { useState } from "react";

interface CourtCommanderControlsProps {
  gamePlans: GamePlan[];
  currentPlanName: string;
  onSavePlanAs: (name: string) => void;
  onLoadPlan: (planId: string) => void;
  onCreateNewPlan: () => void;
  onDeletePlan: (planId: string) => void;
  onRenamePlan: (planId: string, newName: string) => void;
  onPrint: () => void;
  currentPlanId: string;
}

export function CourtCommanderControls({
  gamePlans,
  currentPlanName,
  onSavePlanAs,
  onLoadPlan,
  onCreateNewPlan,
  onDeletePlan,
  onRenamePlan,
  onPrint,
  currentPlanId,
}: CourtCommanderControlsProps) {
  const [savePlanName, setSavePlanName] = useState(currentPlanName);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  
  const [renamePlanId, setRenamePlanId] = useState<string | null>(null);
  const [renamePlanNewName, setRenamePlanNewName] = useState("");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

  const handleSaveClick = () => {
    setSavePlanName(currentPlanName || "New Game Plan");
    setIsSaveDialogOpen(true);
  };

  const handleConfirmSave = () => {
    if (savePlanName.trim()) {
      onSavePlanAs(savePlanName.trim());
      setIsSaveDialogOpen(false);
    }
  };
  
  const handleRenameClick = (planId: string, currentName: string) => {
    setRenamePlanId(planId);
    setRenamePlanNewName(currentName);
    setIsRenameDialogOpen(true);
  };

  const handleConfirmRename = () => {
    if (renamePlanId && renamePlanNewName.trim()) {
      onRenamePlan(renamePlanId, renamePlanNewName.trim());
      setIsRenameDialogOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-card border rounded-lg shadow items-center justify-start no-print">
      <Button onClick={handleSaveClick} variant="outline">
        <Save className="mr-2 h-4 w-4" /> Save Plan As...
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <FolderOpen className="mr-2 h-4 w-4" /> Load Plan ({gamePlans.length})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Saved Game Plans</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {gamePlans.length === 0 && (
            <DropdownMenuItem disabled>No saved plans</DropdownMenuItem>
          )}
          {gamePlans.map((plan) => (
            <div key={plan.id} className="flex items-center justify-between pr-2">
              <DropdownMenuItem
                onClick={() => onLoadPlan(plan.id)}
                className={`flex-grow ${plan.id === currentPlanId ? 'bg-accent/50' : ''}`}
              >
                {plan.name}
              </DropdownMenuItem>
              <div className="flex">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRenameClick(plan.id, plan.name)}>
                  <Edit size={14} />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 size={14} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{plan.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the game plan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDeletePlan(plan.id)} className="bg-destructive hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button onClick={onCreateNewPlan} variant="outline">
        <PlusSquare className="mr-2 h-4 w-4" /> New Plan
      </Button>
      <Button onClick={onPrint} variant="outline">
        <Printer className="mr-2 h-4 w-4" /> Print Plan
      </Button>

      {/* Save Plan Dialog */}
      <AlertDialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline">Save Game Plan As</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a name for this game plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="savePlanName">Plan Name</Label>
            <Input
              id="savePlanName"
              value={savePlanName}
              onChange={(e) => setSavePlanName(e.target.value)}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Plan Dialog */}
      <AlertDialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline">Rename Game Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a new name for this game plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="renamePlanNameInput">New Plan Name</Label>
            <Input
              id="renamePlanNameInput"
              value={renamePlanNewName}
              onChange={(e) => setRenamePlanNewName(e.target.value)}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRename}>Rename</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
