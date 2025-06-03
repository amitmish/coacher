
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InlineBasketballIcon } from "@/components/icons/InlineBasketballIcon"; // Using InlineBasketballIcon as a generic fallback

interface PlayerAvatarProps {
  name: string;
  imageUrl?: string; // Optional image URL
}

export function PlayerAvatar({ name, imageUrl }: PlayerAvatarProps) {
  const getInitials = (playerName: string) => {
    if (!playerName) return "";
    const names = playerName.split(" ");
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (
      names[0].charAt(0) + names[names.length - 1].charAt(0)
    ).toUpperCase();
  };

  return (
    <Avatar className="h-8 w-8">
      {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
        {name ? getInitials(name) : <InlineBasketballIcon className="h-4 w-4" />}
      </AvatarFallback>
    </Avatar>
  );
}
