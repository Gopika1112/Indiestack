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
  cover_image_url: string;
  reading_time_minutes: number;
  word_count: number;
  status: "draft" | "published" | "archived";
  published_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  repost_count?: number;
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

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
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
    fetchAPI<User[]>(`/users/${username}/followers?${buildParams(params)}`),

  getFollowing: (username: string, params?: { limit?: number; offset?: number }) =>
    fetchAPI<User[]>(`/users/${username}/following?${buildParams(params)}`),
};

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
};

// Feed API
export const feedAPI = {
  getFeed: (params?: { cursor?: string; limit?: number }) =>
    fetchAPI<Post[]>(`/feed?${buildParams(params)}`),

  getTrending: (params?: { limit?: number }) =>
    fetchAPI<Post[]>(`/feed/trending?${buildParams(params)}`),

  getLatest: (params?: { limit?: number; offset?: number }) =>
    fetchAPI<Post[]>(`/feed/latest?${buildParams(params)}`),
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
};

// Reposts API
export const repostsAPI = {
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
