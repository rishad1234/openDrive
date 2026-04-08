export type Role = 'user' | 'admin'

export interface AuthUser {
  id: string
  username: string
  role: Role
  email?: string | null
  created_at?: string
}

export interface CreateUserRequest {
  username: string
  password: string
  role: Role
  email?: string
}

export interface UpdateUserRequest {
  password?: string
  role?: Role
  email?: string
}

export interface UpdateProfileRequest {
  username?: string
  current_password?: string
  password?: string
  email?: string | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
}
