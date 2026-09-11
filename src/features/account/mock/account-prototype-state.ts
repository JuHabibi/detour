export type AccountPrototypeState =
  | "signed-out"
  | "login"
  | "signup"
  | "signed-in"
  | "empty";

export function resolveAccountPrototypeState(
  raw: string | undefined,
): AccountPrototypeState {
  if (
    raw === "signed-in" ||
    raw === "empty" ||
    raw === "signed-out" ||
    raw === "login" ||
    raw === "signup"
  ) {
    return raw;
  }
  return "signed-out";
}
