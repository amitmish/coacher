"use client";

import type { Player } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const playerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  jerseyNumber: z.string().optional(),
  position: z.string().optional(),
});

type PlayerFormData = z.infer<typeof playerSchema>;

interface PlayerFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: Player) => void;
  initialData?: Player | null;
}

export function PlayerFormDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  initialData,
}: PlayerFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
  });

  useEffect(() => {
    if (initialData) {
      reset(initialData);
    } else {
      reset({ name: "", jerseyNumber: "", position: "" });
    }
  }, [initialData, reset, isOpen]);

  const handleFormSubmit = (data: PlayerFormData) => {
    const playerToSubmit: Player = {
      id: initialData?.id || crypto.randomUUID(),
      ...data,
    };
    onSubmit(playerToSubmit);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {initialData ? "Edit Player" : "Add New Player"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Update the player's details."
              : "Enter the details for the new player."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <div className="col-span-3">
              <Input
                id="name"
                {...register("name")}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="jerseyNumber" className="text-right">
              Jersey #
            </Label>
            <Input
              id="jerseyNumber"
              {...register("jerseyNumber")}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="position" className="text-right">
              Position
            </Label>
            <Input
              id="position"
              {...register("position")}
              className="col-span-3"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? "Save Changes" : "Add Player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
