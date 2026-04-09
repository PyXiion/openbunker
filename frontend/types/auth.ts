export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  isGuest: boolean;
  isVerified: boolean;
  avatarUrl?: string;
  token?: string;
}

export interface GuestUser {
  userId: string;
  username: string;
  isGuest: true;
}
