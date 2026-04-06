import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Member = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  memberNumber?: string;
  role?: string;
};

type Ctx = {
  token: string | null;
  member: Member | null;
  setSession: (token: string | null, member: Member | null) => void;
  logout: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "oilcoop_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(`${STORAGE_KEY}_token`) : null
  );
  const [member, setMember] = useState<Member | null>(() => {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(`${STORAGE_KEY}_member`);
    return raw ? (JSON.parse(raw) as Member) : null;
  });

  const setSession = useCallback((t: string | null, m: Member | null) => {
    setToken(t);
    setMember(m);
    if (typeof localStorage !== "undefined") {
      if (t) localStorage.setItem(`${STORAGE_KEY}_token`, t);
      else localStorage.removeItem(`${STORAGE_KEY}_token`);
      if (m) localStorage.setItem(`${STORAGE_KEY}_member`, JSON.stringify(m));
      else localStorage.removeItem(`${STORAGE_KEY}_member`);
    }
  }, []);

  const logout = useCallback(() => setSession(null, null), [setSession]);

  const value = useMemo(
    () => ({ token, member, setSession, logout }),
    [token, member, setSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
