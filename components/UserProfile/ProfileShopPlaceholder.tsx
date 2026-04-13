import React from "react";
import { ShoppingBag } from "lucide-react";

export const ProfileShopPlaceholder = ({
  displayName
}: {
  displayName: string;
}) => (
  <div className="flex flex-col items-center justify-center rounded-xl glass-panel px-5 py-20 text-center">
    <ShoppingBag className="mb-4 h-12 w-12 text-white/30" />
    <h2 className="mb-2 font-title text-lg text-white">
      Creator shop coming soon
    </h2>
    <p className="font-body text-sm text-white/50">
      {displayName} will be selling their own products on Beeper.
    </p>
  </div>
);
