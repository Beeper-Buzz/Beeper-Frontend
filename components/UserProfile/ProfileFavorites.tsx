import React from "react";
import { useRouter } from "next/router";
import { UserProfileData } from "@hooks/useUserProfile";

interface ProfileFavoritesProps {
  favorites: UserProfileData["public_favorites"];
}

export const ProfileFavorites = ({ favorites }: ProfileFavoritesProps) => {
  const router = useRouter();

  if (!favorites || favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl glass-panel px-5 py-20 text-center text-white/50">
        No public favorites
      </div>
    );
  }

  return (
    <div className="product-grid-comfortable">
      {favorites.map((favorite) => (
        <div
          key={favorite.id}
          onClick={() => router.push(`/${favorite.slug}`)}
          className="group cursor-pointer overflow-hidden rounded-xl border border-glass-border glass-panel transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="aspect-square bg-muted" />
          <div className="p-4">
            <h3 className="font-title text-sm font-semibold text-white">
              {favorite.name}
            </h3>
            <p className="mt-1 font-body text-sm text-white/50">
              ${favorite.price}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
