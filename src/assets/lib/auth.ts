import { client } from "@/assets/lib/request";

export function login(username: string, password: string) {
  return client.post<AuthenticationResponse>("/auth/login", { username, password });
}

export function register(username: string, password: string) {
  return client.post<AuthenticationResponse>("/auth/register", { username, password });
}

export function getCurrentUser() {
  return client.get<ArenaUser>("/users/me");
}
