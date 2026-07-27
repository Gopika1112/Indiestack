import { z } from "zod";

// ── TipTap Content Schemas ──────────────────────────────────────────
export const TipTapMarkSchema: z.ZodType = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export const TipTapNodeSchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(TipTapNodeSchema).optional(),
    text: z.string().optional(),
    marks: z.array(TipTapMarkSchema).optional(),
  })
);

export const TipTapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(TipTapNodeSchema).optional(),
});

// ── API Model Schemas ───────────────────────────────────────────────
export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  username: z.string(),
  display_name: z.string(),
  bio: z.string(),
  avatar_url: z.string(),
  website: z.string(),
  location: z.string(),
  is_verified: z.boolean(),
  is_premium: z.boolean(),
  follower_count: z.number(),
  following_count: z.number(),
  created_at: z.string(),
});

export const PostSchema = z.object({
  id: z.string(),
  author_id: z.string(),
  author_username: z.string(),
  author_name: z.string(),
  author_avatar: z.string(),
  slug: z.string(),
  title: z.string(),
  content: z.unknown(),
  excerpt: z.string(),
  cover_image_url: z.string(),
  reading_time_minutes: z.number(),
  word_count: z.number(),
  status: z.enum(["draft", "published", "archived"]),
  published_at: z.string(),
  view_count: z.number(),
  like_count: z.number(),
  comment_count: z.number(),
  is_premium: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AuthTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.string(),
  token_type: z.string(),
});

// ── Form Validation Schemas ─────────────────────────────────────────
export const LoginFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const RegisterFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  display_name: z.string().min(1, "Full name is required").max(100, "Name is too long"),
});

export const CreatePostSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.unknown(),
  excerpt: z.string().optional(),
  cover_image_url: z.string().optional(),
  is_premium: z.boolean().optional(),
  slug: z.string().optional(),
  status: z.string().optional(),
});

// ── Inferred Types ──────────────────────────────────────────────────
export type LoginFormData = z.infer<typeof LoginFormSchema>;
export type RegisterFormData = z.infer<typeof RegisterFormSchema>;
export type CreatePostData = z.infer<typeof CreatePostSchema>;
