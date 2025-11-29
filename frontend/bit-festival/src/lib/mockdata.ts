import type { ActivityPost, User } from '../types';

const currentUser: User = {
  name: "Current User",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
  location: "Warsaw, PL"
};

const user1: User = {
  name: "Sarah Jenkins",
  avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
  location: "San Francisco, CA"
};

const user2: User = {
  name: "Mike Ross",
  avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=150",
  location: "New York, NY"
};

export const mockPosts: ActivityPost[] = [
  {
    id: '1',
    user: user1,
    type: 'running',
    timestamp: '2 hours ago',
    image: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&q=80&w=800',
    title: 'Morning 5K Run 🏃‍♀️',
    description: 'Great weather for a morning run! Felt really energetic today. Trying to beat my personal best for the upcoming marathon.',
    stats: {
      duration: '28:45',
      distance: '5.2 km',
      pace: '5:31 /km',
      calories: '320 kcal'
    },
    social: {
      likes: 124,
      comments: 18,
      taggedUsers: []
    }
  },
  {
    id: '2',
    user: user2,
    type: 'cycling',
    timestamp: '5 hours ago',
    title: 'Weekend Long Ride',
    description: 'Exploring the new trails around the national park. The views were breathtaking!',
    stats: {
      duration: '2:15:00',
      distance: '45.5 km',
      pace: '20.2 km/h',
      calories: '1250 kcal'
    },
    social: {
      likes: 89,
      comments: 45,
      taggedUsers: ['Sarah Jenkins']
    },
    partners: [user1]
  },
  {
    id: '3',
    user: currentUser,
    type: 'gym',
    timestamp: 'Yesterday',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=800',
    title: 'Upper Body Workout',
    description: 'Focused on strength training today. Feeling the burn!',
    social: {
      likes: 230,
      comments: 12
    }
  }
];