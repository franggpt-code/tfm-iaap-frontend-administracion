import { HttpClient } from "@angular/common/http";
import { computed, inject, Injectable, signal } from "@angular/core";
import { catchError, Observable, tap, throwError } from "rxjs";
import { environment } from "../../environments/environment";
import { AuthenticatedUser, LoginRequest, LoginResponse } from "../api/sicol.types";

interface StoredSession {
  token: string;
  expiresAt: string;
  user: AuthenticatedUser;
}

const SESSION_KEY = "sicol.admin.session";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = signal<StoredSession | null>(this.readSession());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => {
    const current = this.session();
    return !!current && new Date(current.expiresAt).getTime() > Date.now();
  });

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, payload).pipe(
      tap((response) => this.storeSession(response)),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/auth/logout`, {}).pipe(
      tap(() => this.clearSession()),
      catchError((error: unknown) => {
        this.clearSession();
        return throwError(() => error);
      }),
    );
  }

  refresh(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiBaseUrl}/auth/refresh`, {}).pipe(
      tap((response) => this.storeSession(response)),
    );
  }

  me(): Observable<AuthenticatedUser> {
    return this.http.get<AuthenticatedUser>(`${environment.apiBaseUrl}/auth/me`).pipe(
      tap((user) => {
        const current = this.session();
        if (current) {
          this.persist({ ...current, user });
        }
      }),
    );
  }

  clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
    this.session.set(null);
  }

  private storeSession(response: LoginResponse): void {
    this.persist({
      token: response.token,
      expiresAt: response.expiresAt,
      user: response.user,
    });
  }

  private persist(session: StoredSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  private readSession(): StoredSession | null {
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawSession) as StoredSession;
      if (!parsed.token || !parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
