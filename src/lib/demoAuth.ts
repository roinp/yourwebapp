// Demo login: no real accounts, just remembers in this browser that "შესვლა" was pressed.
const KEY = "yourwebapp:logged-in";

export function isLoggedIn() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
}

export function logIn() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {}
}

export function logOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
