import React from "react";
import { Share2, UserPlus, UserMinus } from "lucide-react";
import { UserProfileData } from "@hooks/useUserProfile";
import { CreatorBadge } from "./CreatorBadge";
import { SocialChip } from "./SocialChip";

interface ProfileBannerProps {
  user: UserProfileData;
  onFollowToggle: () => void;
  onShare: () => void;
}

const getDisplayName = (user: UserProfileData): string => {
  if (user.display_name) return user.display_name;
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (full) return full;
  return user.email.split("@")[0] || "User";
};

const getInitials = (name: string): string =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

export const ProfileBanner = ({
  user,
  onFollowToggle,
  onShare
}: ProfileBannerProps) => {
  const displayName = getDisplayName(user);
  const showBanner = user.is_creator;
  const bannerStyle = user.banner_url
    ? {
        backgroundImage: `url(${user.banner_url})`,
        backgroundSize: "cover" as const,
        backgroundPosition: "center" as const
      }
    : {
        background:
          "linear-gradient(135deg, #7c3aed 0%, #ff008a 50%, #00ffff 100%)"
      };

  return (
    <div className="relative">
      {showBanner && (
        <div
          className="h-40 md:h-64 rounded-xl overflow-hidden border border-glass-border"
          style={bannerStyle}
          aria-hidden="true"
        />
      )}

      <div
        className={`flex items-start gap-6 rounded-xl border border-glass-border glass-panel p-6 ${showBanner ? "-mt-12 relative mx-4 md:mx-8" : ""}`}
      >
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt={`${displayName}'s avatar`}
            className="h-20 w-20 shrink-0 rounded-full border-2 border-glass-border object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-neon-cyan/10 font-title text-2xl font-bold text-neon-cyan">
            {getInitials(displayName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="neon-text-magenta font-pressstart text-lg sm:text-xl">
              {displayName}
            </h1>
            {user.is_creator && <CreatorBadge />}
          </div>
          {user.display_name && (
            <p className="mt-0.5 font-mono text-xs text-white/40">
              @{user.display_name}
            </p>
          )}

          {user.bio && (
            <p className="mt-3 font-body text-sm text-white/70 max-w-prose">
              {user.bio}
            </p>
          )}

          <div className="mt-4 flex items-center gap-6">
            <div className="text-center">
              <span className="block font-title text-lg font-bold text-white">
                {user.followers_count?.toLocaleString()}
              </span>
              <span className="font-body text-xs text-white/50">Followers</span>
            </div>
            <div className="text-center">
              <span className="block font-title text-lg font-bold text-white">
                {user.following_count?.toLocaleString()}
              </span>
              <span className="font-body text-xs text-white/50">Following</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={onFollowToggle}
              className="flex items-center gap-1.5 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 font-body text-xs text-neon-cyan transition-colors hover:bg-neon-cyan/20"
            >
              {user.is_following ? (
                <>
                  <UserMinus className="h-3 w-3" /> Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="h-3 w-3" /> Follow
                </>
              )}
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 rounded-lg border border-glass-border px-3 py-1.5 font-body text-xs text-white/70 transition-colors hover:text-white"
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>

          {user.is_creator && (
            <div className="mt-4 flex flex-wrap gap-2">
              {user.socials.instagram && (
                <SocialChip
                  platform="instagram"
                  handle={user.socials.instagram}
                />
              )}
              {user.socials.tiktok && (
                <SocialChip platform="tiktok" handle={user.socials.tiktok} />
              )}
              {user.socials.youtube && (
                <SocialChip platform="youtube" handle={user.socials.youtube} />
              )}
              {user.socials.soundcloud && (
                <SocialChip
                  platform="soundcloud"
                  handle={user.socials.soundcloud}
                />
              )}
              {user.socials.bandcamp && (
                <SocialChip
                  platform="bandcamp"
                  handle={user.socials.bandcamp}
                />
              )}
              {user.website && (
                <SocialChip platform="website" handle={user.website} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
