import React from "react";
import { useRouter } from "next/router";
import { Play } from "lucide-react";
import { UserProfileStream } from "@hooks/useUserProfile";

interface ProfileStreamsProps {
  streams: UserProfileStream[];
}

const formatEndedAt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

export const ProfileStreams = ({ streams }: ProfileStreamsProps) => {
  const router = useRouter();

  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl glass-panel px-5 py-20 text-center text-white/50">
        No recent streams
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {streams.map((stream) => (
        <button
          key={stream.id}
          onClick={() => router.push(`/tv/${stream.id}`)}
          className="group text-left glass-panel rounded-xl overflow-hidden hover:-translate-y-0.5 transition-all cursor-pointer"
        >
          <div className="relative aspect-video bg-surface-deep">
            {stream.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stream.thumbnail_url}
                alt={stream.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-neon-magenta/20 to-neon-cyan/20" />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <Play className="h-12 w-12 text-white" />
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-title text-sm font-semibold text-white truncate">
              {stream.title}
            </h3>
            <p className="mt-1 font-mono text-xs text-white/40">
              Ended {formatEndedAt(stream.ended_at)}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};
