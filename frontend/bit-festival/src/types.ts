export interface User {
  id: string;
  name: string;
  avatar: string;
  location?: string;
}

export interface ActivityStats {
  duration: string;
  distance: string;
  pace: string;
  calories: string;
}

export interface CommentData {
  user_id: string;
  user_display_name: string;
  text: string;
  timestamp: string;
}

export interface SocialData {
  likes: number;
  comments: number;
  taggedUsers?: string[];
  userLiked?: boolean;
  lastComment?: CommentData | null;
}

export interface ActivityPost {
  id: string;
  user: User;
  type: 'running' | 'social' | 'cycling' | 'gym' | 'hiking' | 'other';
  timestamp: string;
  image?: string;
  title: string;
  description: string;
  stats?: ActivityStats;
  social: SocialData;
  partners?: User[];
  coords?: { lat: number; lng: number };
}