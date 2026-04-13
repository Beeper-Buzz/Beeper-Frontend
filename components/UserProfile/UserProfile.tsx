import React, { useState } from "react";
import Head from "next/head";
import {
  useUserProfileByHandle,
  useFollowUser,
  useUnfollowUser
} from "@hooks/useUserProfile";
import { Loading } from "@components/Loading";
import { ProfileBanner } from "./ProfileBanner";
import { ProfileTabs, ProfileTab } from "./ProfileTabs";
import { ProfileFavorites } from "./ProfileFavorites";
import { ProfileStreams } from "./ProfileStreams";
import { ProfileShopPlaceholder } from "./ProfileShopPlaceholder";
import { UserProfile as LegacyUserProfile } from "./legacy/UserProfile";

interface UserProfileProps {
  username: string;
}

const FLAG_ENABLED =
  process.env.NEXT_PUBLIC_CREATOR_PROFILE_ENABLED === "true";

export const UserProfile: React.FC<UserProfileProps> = ({ username }) => {
  if (!FLAG_ENABLED) {
    return <LegacyUserProfile username={username} />;
  }

  return <UserProfileInner username={username} />;
};

const UserProfileInner: React.FC<UserProfileProps> = ({ username }) => {
  const { data: user, isLoading, error } = useUserProfileByHandle(username);
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const [activeTab, setActiveTab] = useState<ProfileTab>("favorites");

  const handleFollowToggle = () => {
    if (!user) return;
    if (user.is_following) {
      unfollowMutation.mutate(String(user.id));
    } else {
      followMutation.mutate(String(user.id));
    }
  };

  const handleShare = async () => {
    if (!user) return;
    const url = `https://beeper.buzz/${user.display_name || user.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: user.display_name || "Beeper Profile",
          url
        });
        return;
      } catch {
        // User cancelled share dialog; fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
  };

  if (isLoading) {
    return (
      <div className="section-container py-10">
        <Loading />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="section-container py-10">
        <div className="flex flex-col items-center justify-center rounded-xl glass-panel px-5 py-20 text-center text-white/50">
          User not found
        </div>
      </div>
    );
  }

  const displayName =
    user.display_name ||
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    "Beeper User";
  const ogImage =
    user.banner_url || user.avatar_url || "/images/beeper-og-image.png";

  return (
    <>
      <Head>
        <title>{displayName} &middot; Beeper</title>
        <meta
          name="description"
          content={user.bio || `${displayName} on Beeper`}
        />
        <meta property="og:title" content={`${displayName} · Beeper`} />
        <meta property="og:description" content={user.bio || ""} />
        <meta property="og:image" content={ogImage} />
        <meta
          property="og:url"
          content={`https://beeper.buzz/${user.display_name || user.id}`}
        />
        <meta property="og:type" content="profile" />
      </Head>

      <div className="section-container py-10">
        <ProfileBanner
          user={user}
          onFollowToggle={handleFollowToggle}
          onShare={handleShare}
        />

        <ProfileTabs
          active={activeTab}
          onChange={setActiveTab}
          showStreams={user.is_creator && user.recent_streams.length > 0}
          showShop={user.is_creator}
        />

        {activeTab === "favorites" && (
          <ProfileFavorites favorites={user.public_favorites} />
        )}
        {activeTab === "streams" && (
          <ProfileStreams streams={user.recent_streams} />
        )}
        {activeTab === "shop" && (
          <ProfileShopPlaceholder displayName={displayName} />
        )}
      </div>
    </>
  );
};
