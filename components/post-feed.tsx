"use client";

import type { CommunityUser, Story } from "@/data/archive";
import { StoryCard } from "@/components/story-card";

export interface PostFeedProps {
  stories: Story[];
  currentUser: CommunityUser | null;
  switching: boolean;
  justPostedId?: string;
  onRequireIdentity: () => void;
  onDeleted: (id: string) => void;
  onLikeChanged: (id: string, count: number) => void;
}

export function PostFeed({ stories, currentUser, switching, justPostedId, onRequireIdentity, onDeleted, onLikeChanged }: PostFeedProps) {
  return (
    <div className={`story-list${switching ? " list-switching" : ""}`} aria-live="polite">
      {stories.map((story) => (
        <StoryCard
          story={story}
          currentUser={currentUser}
          justPosted={justPostedId === story.id}
          onRequireIdentity={onRequireIdentity}
          onDeleted={onDeleted}
          onLikeChanged={onLikeChanged}
          key={`${story.id}-${currentUser?.id ?? "guest"}`}
        />
      ))}
    </div>
  );
}
