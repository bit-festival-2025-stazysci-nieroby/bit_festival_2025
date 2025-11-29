export interface User {
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

export interface SocialData {
  likes: number;
  comments: number;
  taggedUsers?: string[];
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
}