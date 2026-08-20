export interface FoundingBadge {
  signup_number: number;
  type: 'founder' | 'early_star' | 'founding_member';
  icon: string;
  label: string;
  tooltip: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  handle?: string;
  year?: string | null;
  branch?: string | null;
  bio?: string | null;
  photos: string[];
  email_verified: boolean;
  college_verified: boolean;
  swipe_mode: string; // 'swipe' or other
  read_receipts_enabled: boolean;
  signup_number?: number;
  founding_badge?: FoundingBadge | null;
  created_at: string;
  interests?: Interest[];
  prompts?: Prompt[];
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  is_following?: boolean;
  is_admin?: boolean;
  is_banned?: boolean;
  ban_reason?: string | null;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollData {
  id?: string;
  question: string;
  options: PollOption[];
  total_votes?: number;
  user_voted_option_id?: string | null;
  duration?: string | null;
  expires_at?: string | null;
  votes_by_user?: Record<string, string>;
}

export interface Post {
  id: string;
  author_id: string;
  author: {
    id: string;
    name: string;
    handle: string;
    photos: string[];
    branch?: string | null;
    year?: string | null;
    college_verified?: boolean;
    is_banned?: boolean;
    signup_number?: number;
    founding_badge?: FoundingBadge | null;
  };
  title: string;
  content: string;
  media_url?: string | null;
  topic: string;
  upvotes: number;
  downvotes: number;
  score: number;
  user_vote?: 'up' | 'down' | null;
  comment_count: number;
  comments?: PostComment[];
  is_anonymous?: boolean;
  poll?: PollData | null;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  author: {
    id: string;
    name: string;
    handle: string;
    photos: string[];
    founding_badge?: FoundingBadge | null;
  };
  content: string;
  created_at: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Interest {
  id: number;
  name: string;
  category: string;
}

export interface UserInterest {
  user_id: string;
  interest_id: number;
}

export interface Prompt {
  id: string;
  user_id: string;
  question: string;
  answer: string;
}

export interface Swipe {
  id: string;
  from_user_id: string;
  to_user_id: string;
  action: 'like' | 'pass';
  created_at: string;
}

export interface Match {
  id: string;
  user_a_id: string;
  user_b_id: string;
  matched_at: string;
  other_user?: {
    id: string;
    name: string;
    photos: string[];
    bio?: string | null;
    year?: string | null;
    branch?: string | null;
    college_verified: boolean;
  };
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  read_at?: string | null;
}

export interface Room {
  id: string;
  name: string;
  type: string;
  interest_id?: number | null;
  created_by?: string | null;
  expires_at?: string | null;
  created_at: string;
  member_count?: number;
  is_official?: boolean;
  is_private?: boolean;
  invite_code?: string | null;
  topic?: string | null;
  last_message?: {
    content: string;
    sender_name: string;
    sent_at: string;
  } | null;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_handle?: string | null;
  sender_photo?: string | null;
  content: string;
  sent_at: string;
  reply_to_id?: string | null;
  reply_to_name?: string | null;
  reply_to_content?: string | null;
  reactions?: Record<string, number>;
}

export interface CollegeEmailOtp {
  id: string;
  user_id: string;
  college_email: string;
  otp_hash: string;
  expires_at: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reporter_name?: string;
  reported_user_id: string;
  reported_user_name?: string;
  reported_user_banned?: boolean;
  reason: string;
  context?: string | null;
  status: 'pending' | 'reviewed' | 'actioned' | 'resolved';
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  admin_name: string;
  action_type: 'remove_post' | 'remove_room_message' | 'ban_user' | 'unban_user' | 'update_report' | 'review_appeal';
  target_id: string;
  target_label?: string;
  reason?: string | null;
  created_at: string;
}

export interface BanAppeal {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  created_at: string;
}
