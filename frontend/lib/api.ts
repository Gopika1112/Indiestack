const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    next_cursor?: string;
    has_more?: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  website: string;
  location: string;
  is_verified: boolean;
  is_premium: boolean;
  follower_count: number;
  following_count: number;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  author_username: string;
  author_name: string;
  author_avatar: string;
  slug: string;
  title: string;
  content: Record<string, unknown>;
  excerpt: string;
  tags?: string[];
  cover_image_url: string;
  reading_time_minutes: number;
  word_count: number;
  status: "draft" | "published" | "archived";
  published_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  repost_count?: number;
  clap_count?: number;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  token_type: string;
}

function buildParams(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined
  );
  if (entries.length === 0) return "";
  return new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  ).toString();
}

// tryRefreshToken attempts to exchange the stored refresh token for a new
// access token. Returns true and updates localStorage on success.
async function tryRefreshToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json();
    if (!res.ok || !data?.data?.access_token) return false;
    localStorage.setItem("access_token", data.data.access_token);
    if (data.data.refresh_token) {
      localStorage.setItem("refresh_token", data.data.refresh_token);
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<APIResponse<T>> {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // On 401 (expired access token), transparently refresh once and retry.
  if (response.status === 401 && !isRetry && endpoint !== "/auth/refresh") {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return fetchAPI<T>(endpoint, options, true);
    }
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "API request failed");
  }

  return data;
}

// Auth API
export const authAPI = {
  register: (data: {
    email: string;
    username: string;
    password: string;
    display_name: string;
  }) =>
    fetchAPI<{ user: User; tokens: AuthTokens }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    fetchAPI<{ user: User; tokens: AuthTokens }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  logout: () => fetchAPI<void>("/auth/logout", { method: "POST" }),

  getMe: () => fetchAPI<{ user: User }>("/auth/me"),

  refresh: (refresh_token: string) =>
    fetchAPI<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),
};

// User API
export const userAPI = {
  getByUsername: (username: string) => fetchAPI<User>(`/users/${username}`),

  updateProfile: (data: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    website?: string;
    location?: string;
  }) =>
    fetchAPI<User>("/users/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Backend follow route is /api/v1/follow and takes the target user's ID.
  follow: (userId: string) =>
    fetchAPI<{ status: string }>("/follow", {
      method: "POST",
      body: JSON.stringify({ following_id: userId }),
    }),

  unfollow: (userId: string) =>
    fetchAPI<{ status: string }>("/follow", {
      method: "DELETE",
      body: JSON.stringify({ following_id: userId }),
    }),

  getFollowers: (username: string, params?: { limit?: number; offset?: number }) =>
    fetchAPI<FollowListUser[]>(`/users/${username}/followers?${buildParams(params)}`),

  getFollowing: (username: string, params?: { limit?: number; offset?: number }) =>
    fetchAPI<FollowListUser[]>(`/users/${username}/following?${buildParams(params)}`),
};

// Compact user shape returned by the followers/following list endpoints.
export interface FollowListUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  bio: string;
}

// Profile API (Penmark profiles table — separate from users table)
export interface Profile {
  id: string;
  user_id: string;
  name: string;
  headline: string;
  company: string;
  location: string;
  website: string;
  bio: string;
  avatar_url: string;
  open_to_work: boolean;
}

export const profilesAPI = {
  getMe: () => fetchAPI<Profile>("/profiles/me"),

  updateMe: (
    userId: string,
    data: {
      name?: string;
      headline?: string;
      bio?: string;
      website?: string;
      location?: string;
    }
  ) =>
    fetchAPI<{ status: string }>(`/profiles/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// Post API
export const postAPI = {
  getBySlug: (username: string, slug: string) =>
    fetchAPI<Post>(`/posts/slug/${username}/${slug}`),

  getById: (id: string) => fetchAPI<Post>(`/posts/${id}`),

  create: (data: {
    title: string;
    content: Record<string, unknown>;
    excerpt?: string;
    tags?: string[];
    cover_image_url?: string;
    is_premium?: boolean;
    slug?: string;
    status?: string;
  }) =>
    fetchAPI<Post>("/posts/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (
    id: string,
    data: Partial<{
      title: string;
      content: Record<string, unknown>;
      excerpt: string;
      tags: string[];
      cover_image_url: string;
      is_premium: boolean;
      status: string;
    }>
  ) =>
    fetchAPI<Post>(`/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) => fetchAPI<void>(`/posts/${id}`, { method: "DELETE" }),

  publish: (id: string) =>
    fetchAPI<Post>(`/posts/${id}/publish`, { method: "POST" }),

  listByAuthor: (username: string, params?: { limit?: number; offset?: number }) =>
    fetchAPI<Post[]>(`/users/${username}/posts?${buildParams(params)}`),

  getMyPosts: () => fetchAPI<Post[]>("/posts/mine"),

  getRelated: (id: string) => fetchAPI<Post[]>(`/posts/${id}/related`),

  getStats: (id: string) => fetchAPI<{ views: number; claps: number; comments: number; reposts: number }>(`/posts/stats/${id}`),
};

// Tags API
export interface TagCount {
  tag: string;
  count: number;
}

export const tagsAPI = {
  list: () => fetchAPI<TagCount[]>("/tags"),
};

// Feed API
export const feedAPI = {
  getFeed: (params?: { cursor?: string; limit?: number }) =>
    fetchAPI<Post[]>(`/feed?${buildParams(params)}`),

  getTrending: (params?: { limit?: number }) =>
    fetchAPI<Post[]>(`/feed/trending?${buildParams(params)}`),

  getLatest: (params?: { limit?: number; offset?: number }) =>
    fetchAPI<Post[]>(`/feed/latest?${buildParams(params)}`),

  getByTag: (tag: string, params?: { limit?: number }) =>
    fetchAPI<Post[]>(`/feed/by-tag?tag=${encodeURIComponent(tag)}&${buildParams(params)}`),

  getTrendingPosts: () => fetchAPI<Post[]>("/feed/trending-posts"),

  getTrendingTopics: () => fetchAPI<TagCount[]>("/feed/trending-topics"),

  getFollowingTopicsFeed: () => fetchAPI<Post[]>("/feed/following-topics"),
};

// Topics (follow/unfollow topics)
export const topicsAPI = {
  follow: (tag: string) =>
    fetchAPI<{ status: string; tag: string }>("/topics/follow", {
      method: "POST",
      body: JSON.stringify({ tag }),
    }),

  unfollow: (tag: string) =>
    fetchAPI<{ status: string; tag: string }>("/topics/follow", {
      method: "DELETE",
      body: JSON.stringify({ tag }),
    }),

  listFollowed: () => fetchAPI<string[]>("/topics/following"),
};

// API Key types
export interface APIKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

// API Keys API
export const apiKeysAPI = {
  list: () => fetchAPI<APIKeyItem[]>("/api-keys"),

  create: (data: { name: string; scopes: string[]; expires_in_days?: number }) =>
    fetchAPI<{ key: string; api_key: APIKeyItem }>("/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: string) => fetchAPI<void>(`/api-keys/${id}`, { method: "DELETE" }),
};

// Likes API
export const likesAPI = {
  like: (postId: string) =>
    fetchAPI<{ status: string }>("/likes", {
      method: "POST",
      body: JSON.stringify({ post_id: postId }),
    }),
  unlike: (postId: string) =>
    fetchAPI<{ status: string }>("/likes", {
      method: "DELETE",
      body: JSON.stringify({ post_id: postId }),
    }),
};

// Comments API
export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  username: string;
  like_count: number;
  liked: boolean;
  created_at: string;
}

export const commentsAPI = {
  list: (postId: string) =>
    fetchAPI<Comment[]>(`/comments?post_id=${encodeURIComponent(postId)}`),
  add: (postId: string, body: string, parentId?: string) =>
    fetchAPI<{ id: string }>("/comments", {
      method: "POST",
      body: JSON.stringify({ post_id: postId, body, parent_id: parentId }),
    }),
  update: (id: string, body: string) =>
    fetchAPI<{ status: string }>(`/comments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ body }),
    }),
  delete: (id: string) =>
    fetchAPI<{ status: string }>(`/comments/${id}`, { method: "DELETE" }),
  like: (id: string) =>
    fetchAPI<{ status: string }>(`/comments/${id}/like`, { method: "POST" }),
  unlike: (id: string) =>
    fetchAPI<{ status: string }>(`/comments/${id}/like`, { method: "DELETE" }),
};

// Reposts API
export const repostsAPI = {
  list: (username?: string) =>
    fetchAPI<Post[]>(`/reposts${username ? `?username=${encodeURIComponent(username)}` : ""}`),

  getState: (postId: string) =>
    fetchAPI<{ reposted: boolean }>(`/reposts/state?post_id=${encodeURIComponent(postId)}`),

  repost: (postId: string) =>
    fetchAPI<{ status: string }>("/reposts", {
      method: "POST",
      body: JSON.stringify({ post_id: postId }),
    }),
  unrepost: (postId: string) =>
    fetchAPI<{ status: string }>(`/reposts?post_id=${encodeURIComponent(postId)}`, {
      method: "DELETE",
    }),
};

// Mutes API
export interface MutedUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
}

export const mutesAPI = {
  list: () => fetchAPI<MutedUser[]>("/mutes"),
  
  mute: (mutedUserId: string) =>
    fetchAPI<{ status: string }>("/mutes", {
      method: "POST",
      body: JSON.stringify({ muted_user_id: mutedUserId }),
    }),
  
  unmute: (mutedUserId: string) =>
    fetchAPI<{ status: string }>(`/mutes?muted_user_id=${encodeURIComponent(mutedUserId)}`, {
      method: "DELETE",
    }),
};

// Bookmarks API
export interface Bookmark {
  user_id: string;
  post_id: string;
  title?: string;
  slug?: string;
  created_at: string;
}

export const bookmarksAPI = {
  list: () => fetchAPI<Bookmark[]>("/bookmarks"),

  add: (postId: string) =>
    fetchAPI<{ status: string }>("/bookmarks", {
      method: "POST",
      body: JSON.stringify({ post_id: postId }),
    }),

  remove: (postId: string) =>
    fetchAPI<{ status: string }>(`/bookmarks?post_id=${encodeURIComponent(postId)}`, {
      method: "DELETE",
    }),
};

// Reading History API
export interface HistoryItem {
  id: string;
  post_id: string;
  title: string;
  slug: string;
  author_username: string;
  read_at: string;
}

export const historyAPI = {
  list: () => fetchAPI<HistoryItem[]>("/history"),

  record: (postId: string) =>
    fetchAPI<{ status: string }>("/history", {
      method: "POST",
      body: JSON.stringify({ post_id: postId }),
    }),
};

// Notifications API
export interface NotificationItem {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export const notificationsAPI = {
  list: () => fetchAPI<NotificationItem[]>("/notifications"),
  markAllRead: () =>
    fetchAPI<{ status: string }>("/notifications", { method: "PUT" }),
};

// Reader highlights API
export interface PostHighlight {
  id: string;
  user_id: string;
  post_id: string;
  text: string;
  color: string;
  created_at: string;
  post_title?: string;
  post_slug?: string;
  author_username?: string;
}

export const highlightsAPI = {
  list: (postId?: string) =>
    fetchAPI<PostHighlight[]>(`/highlights${postId ? `?post_id=${encodeURIComponent(postId)}` : ""}`),
  add: (postId: string, text: string, color = "yellow") =>
    fetchAPI<{ id: string }>("/highlights", {
      method: "POST",
      body: JSON.stringify({ post_id: postId, text, color }),
    }),
  remove: (id: string) =>
    fetchAPI<{ status: string }>(`/highlights/${id}`, { method: "DELETE" }),
};

// Upload API
export const uploadAPI = {
  upload: async (file: File): Promise<{ url: string; filename: string; size: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Upload failed");
    }
    return data.data;
  },
};

// ---------- Settings API ----------

export interface AccountSettings {
  email: string;
  username: string;
  phone: string;
  language: string;
  timezone: string;
}

export interface PublicProfileSettings {
  name?: string;
  display_name?: string;
  cover_image_url?: string;
  short_bio?: string;
  bio?: string;
  website?: string;
  github_url?: string;
  linkedin_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  profile_visibility?: string;
}

export interface SecuritySettings {
  two_factor_enabled: boolean;
  recovery_email: string;
}

export interface SessionItem {
  id: string;
  user_agent: string;
  ip: string;
  device: string;
  last_used_at: string;
  created_at: string;
}

export interface ConnectedAccount {
  provider: string;
  provider_account_id: string;
  connected_at: string;
}

export type Prefs = Record<string, boolean | string>;

export const settingsAPI = {
  // Account
  getAccount: () => fetchAPI<AccountSettings>("/settings/account"),
  updateAccount: (data: Partial<AccountSettings>) =>
    fetchAPI<{ message: string }>("/settings/account", { method: "PUT", body: JSON.stringify(data) }),

  // Public profile
  getPublicProfile: () => fetchAPI<PublicProfileSettings>("/settings/public-profile"),
  updatePublicProfile: (data: Partial<PublicProfileSettings>) =>
    fetchAPI<{ message: string }>("/settings/public-profile", { method: "PUT", body: JSON.stringify(data) }),

  // Security
  getSecurity: () => fetchAPI<SecuritySettings>("/settings/security"),
  updateSecurity: (data: Partial<SecuritySettings>) =>
    fetchAPI<{ message: string }>("/settings/security", { method: "PUT", body: JSON.stringify(data) }),
  changePassword: (current_password: string, new_password: string) =>
    fetchAPI<{ message: string }>("/settings/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),

  // Sessions
  listSessions: () => fetchAPI<SessionItem[]>("/settings/sessions"),
  revokeSession: (id: string) =>
    fetchAPI<{ message: string }>(`/settings/sessions/${id}`, { method: "DELETE" }),
  revokeAllSessions: () =>
    fetchAPI<{ message: string }>("/settings/sessions/revoke-all", { method: "POST" }),

  // Generic preference groups
  getNotifications: () => fetchAPI<Prefs>("/settings/notifications"),
  updateNotifications: (data: Prefs) =>
    fetchAPI<{ message: string }>("/settings/notifications", { method: "PUT", body: JSON.stringify(data) }),

  getPrivacy: () => fetchAPI<Prefs>("/settings/privacy"),
  updatePrivacy: (data: Prefs) =>
    fetchAPI<{ message: string }>("/settings/privacy", { method: "PUT", body: JSON.stringify(data) }),

  getWriting: () => fetchAPI<Prefs>("/settings/writing"),
  updateWriting: (data: Prefs) =>
    fetchAPI<{ message: string }>("/settings/writing", { method: "PUT", body: JSON.stringify(data) }),

  getReading: () => fetchAPI<Prefs>("/settings/reading"),
  updateReading: (data: Prefs) =>
    fetchAPI<{ message: string }>("/settings/reading", { method: "PUT", body: JSON.stringify(data) }),

  getEmail: () => fetchAPI<Prefs>("/settings/email"),
  updateEmail: (data: Prefs) =>
    fetchAPI<{ message: string }>("/settings/email", { method: "PUT", body: JSON.stringify(data) }),

  // Connected accounts
  listConnected: () => fetchAPI<ConnectedAccount[]>("/settings/connected-accounts"),
  connectAccount: (provider: string, provider_account_id = "") =>
    fetchAPI<{ message: string }>("/settings/connected-accounts", {
      method: "POST",
      body: JSON.stringify({ provider, provider_account_id }),
    }),
  disconnectAccount: (provider: string) =>
    fetchAPI<{ message: string }>(`/settings/connected-accounts/${provider}`, { method: "DELETE" }),

  // Danger zone
  exportData: () => fetchAPI<unknown>("/settings/export-data"),
  deleteAccount: () => fetchAPI<{ message: string }>("/settings/delete-account", { method: "DELETE" }),
  deactivateAccount: () => fetchAPI<{ message: string }>("/settings/deactivate-account", { method: "POST" }),
  removeAllStories: () => fetchAPI<{ message: string }>("/settings/remove-all-stories", { method: "POST" }),
};

// ---------- Publications API ----------

export interface Publication {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  owner_id: string;
  owner_name: string;
  follower_count: number;
  post_count: number;
  created_at: string;
}

export interface PublicationMember {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  role: string;
}

export const publicationsAPI = {
  list: () => fetchAPI<Publication[]>("/publications"),

  listMine: () => fetchAPI<Publication[]>("/publications?mine=1"),

  get: (slug: string) => fetchAPI<Publication>(`/publications/${slug}`),

  create: (data: { name: string; slug?: string; description?: string; logo_url?: string }) =>
    fetchAPI<{ id: string; slug: string }>("/publications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (slug: string, data: { name?: string; description?: string; logo_url?: string }) =>
    fetchAPI<{ status: string }>(`/publications/${slug}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (slug: string) =>
    fetchAPI<{ status: string }>(`/publications/${slug}`, { method: "DELETE" }),

  posts: (slug: string) => fetchAPI<Post[]>(`/publications/${slug}/posts`),

  addPost: (slug: string, postId: string) =>
    fetchAPI<{ status: string }>(`/publications/${slug}/posts`, {
      method: "POST",
      body: JSON.stringify({ post_id: postId }),
    }),

  removePost: (slug: string, postId: string) =>
    fetchAPI<{ status: string }>(`/publications/${slug}/posts?post_id=${encodeURIComponent(postId)}`, {
      method: "DELETE",
    }),

  follow: (slug: string) =>
    fetchAPI<{ status: string }>(`/publications/${slug}/follow`, { method: "POST" }),

  unfollow: (slug: string) =>
    fetchAPI<{ status: string }>(`/publications/${slug}/follow`, { method: "DELETE" }),

  members: (slug: string) => fetchAPI<PublicationMember[]>(`/publications/${slug}/members`),

  addMember: (slug: string, username: string, role?: string) =>
    fetchAPI<{ status: string }>(`/publications/${slug}/members`, {
      method: "POST",
      body: JSON.stringify({ username, role }),
    }),

  removeMember: (slug: string, username: string) =>
    fetchAPI<{ status: string }>(`/publications/${slug}/members?username=${encodeURIComponent(username)}`, {
      method: "DELETE",
    }),
};

// ---------- Lists API ----------

export interface ReadingList {
  id: string;
  user_id: string;
  owner_username: string;
  owner_name: string;
  name: string;
  description: string;
  is_public: boolean;
  item_count: number;
  created_at: string;
}

export const listsAPI = {
  list: () => fetchAPI<ReadingList[]>("/lists"),

  listMine: () => fetchAPI<ReadingList[]>("/lists?mine=1"),

  get: (id: string) => fetchAPI<ReadingList>(`/lists/${id}`),

  create: (data: { name: string; description?: string; is_public?: boolean }) =>
    fetchAPI<{ id: string }>("/lists", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; description?: string; is_public?: boolean }) =>
    fetchAPI<{ status: string }>(`/lists/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    fetchAPI<{ status: string }>(`/lists/${id}`, { method: "DELETE" }),

  items: (id: string) => fetchAPI<Post[]>(`/lists/${id}/items`),

  addItem: (id: string, postId: string) =>
    fetchAPI<{ status: string }>(`/lists/${id}/items`, {
      method: "POST",
      body: JSON.stringify({ post_id: postId }),
    }),

  removeItem: (id: string, postId: string) =>
    fetchAPI<{ status: string }>(`/lists/${id}/items?post_id=${encodeURIComponent(postId)}`, {
      method: "DELETE",
    }),
};

// ---------- Reports API (Content Moderation) ----------

export interface Report {
  id: string;
  reporter_id: string;
  reporter_username: string;
  post_id?: string;
  comment_id?: string;
  post_title?: string;
  comment_body?: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
}

export const reportsAPI = {
  create: (data: { post_id?: string; comment_id?: string; reason: string; details?: string }) =>
    fetchAPI<{ id: string; status: string }>("/reports", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  list: (status?: string) =>
    fetchAPI<Report[]>(`/reports${status ? `?status=${encodeURIComponent(status)}` : ""}`),

  update: (id: string, status: string) =>
    fetchAPI<{ status: string }>(`/reports/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),
};

// ---------- Claps API ----------

export const clapsAPI = {
  clap: (postId: string, count: number = 1) =>
    fetchAPI<{ status: string; user_count: number; total: number }>("/claps", {
      method: "POST",
      body: JSON.stringify({ post_id: postId, count }),
    }),

  unclap: (postId: string) =>
    fetchAPI<{ status: string }>(`/claps?post_id=${encodeURIComponent(postId)}`, {
      method: "DELETE",
    }),

  getCount: (postId: string) =>
    fetchAPI<{ total: number; user_count: number }>(`/claps/${postId}`),
};

// ---------- Responses API ----------

export const responsesAPI = {
  list: (postId: string) =>
    fetchAPI<Post[]>(`/responses?post_id=${encodeURIComponent(postId)}`),

  create: (data: {
    parent_post_id: string;
    title: string;
    content: Record<string, unknown>;
    excerpt?: string;
    tags?: string[];
  }) =>
    fetchAPI<{ id: string; slug: string }>("/responses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
