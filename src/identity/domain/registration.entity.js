export const REGISTRATION_ROLES = [
  "ProductionSpecialist",
  "PurchaseAnalyst",
  "PurchaseManager",
];

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const DISPLAY_NAME_PATTERN = /^\p{L}[\p{L}\p{M} .'-]*$/u;

export function isDisplayNameValid(name) {
  const trimmed = name.trim();
  return (
    trimmed.length >= 2 &&
    trimmed.length <= 150 &&
    DISPLAY_NAME_PATTERN.test(trimmed)
  );
}

export function passwordRules(password, email) {
  const localPart = email.trim().split("@", 1)[0];
  return {
    length:
      password.length >= PASSWORD_MIN_LENGTH &&
      password.length <= PASSWORD_MAX_LENGTH,
    upper: /\p{Lu}/u.test(password),
    lower: /\p{Ll}/u.test(password),
    digit: /\p{Nd}/u.test(password),
    symbol: /[\p{P}\p{S}]/u.test(password),
    control: !/\p{Cc}/u.test(password),
    email:
      localPart.length < 3 ||
      !password.toLowerCase().includes(localPart.toLowerCase()),
  };
}

export function isPasswordValid(password, email) {
  return Object.values(passwordRules(password, email)).every(Boolean);
}
