export type AccountAuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AccountAuthState =
  | { status: "authenticated"; user: AccountAuthUser }
  | { status: "unauthenticated" };
