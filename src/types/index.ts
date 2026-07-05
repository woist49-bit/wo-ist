export interface Profile {
  id: string
  username: string
  created_at: string
  global_xp: number
  global_level: number
  global_wins: number
  avatar_url: string | null
  tutorial_completed: boolean
  gems: number
  equipped_frame: string | null
}

export interface World {
  id: string
  name: string
  description: string | null
  whatsapp_link: string | null
  join_code: string
  created_by: string
  created_at: string
}

export interface WorldMember {
  world_id: string
  user_id: string
  role: 'admin' | 'user'
  certified: boolean
  joined_at: string
  profile?: Profile
}

export interface LiveEvent {
  id: string
  world_id: string
  title: string
  description?: string | null
  starts_at: string
  ends_at: string
  daily_release_hour: number
  daily_release_minute: number
  status: 'draft' | 'active' | 'finished'
  created_by: string
}

export interface EventImage {
  id: string
  event_id: string | null
  campaign_id: string | null
  world_id: string
  image_url: string
  description: string | null
  unlocks_at: string
  sort_order: number
  target_x: number
  target_y: number
  target_radius: number
  uploaded_by: string
}

export interface PlayerAttempt {
  id: string
  image_id: string
  user_id: string
  click_x: number
  click_y: number
  is_correct: boolean
  points: number
  time_seconds: number
  attempted_at: string
}

export interface Achievement {
  id: string
  key: string
  name: string
  description: string
  tier: 'bronze' | 'silver' | 'gold'
  xp_reward: number
  global?: boolean // nicht an eine Spielwelt gebunden (z. B. Tutorial) -> nicht in Welt-Erfolgen listen
}

export interface PlayerAchievement {
  id: string
  user_id: string
  world_id: string
  achievement_key: string
  earned_at: string
}

export interface Campaign {
  id: string
  world_id: string
  title: string
  original_event_id: string | null
  created_at: string
  is_legacy: boolean
}

export interface LeaderboardEntry {
  user_id: string
  username: string
  total_points: number
  wins: number
  achievement_count: number
  xp: number
}

export interface EventLeaderboardEntry {
  user_id: string
  username: string
  total_points: number
  finds: number
  xp: number
}
