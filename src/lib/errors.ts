const MESSAGES: Record<string, string> = {
  EVENT_NOT_FOUND: "This event could not be found.",
  REGISTRATION_CLOSED: "Registration for this event is closed.",
  INVALID_NAME: "Please enter your full name.",
  INVALID_PHONE: "Please enter a valid phone number, e.g. 0773 126 865.",
  INVALID_EMAIL: "That email address doesn't look right.",
  INVALID_GENDER: "Please choose a gender.",
  INVALID_ROLE: "Please choose your role.",
  INVALID_VENUE: "Please choose a venue.",
  VENUE_FULL: "Sorry, that venue is fully booked. Please choose another venue.",
  NOT_AUTHORISED: "You are not authorised to do that.",
  NOT_FOUND: "Record not found, or it has already been changed.",
  REGISTRATION_INACTIVE: "This registration is cancelled or expired. Reinstate it first.",
  INVALID_AMOUNT: "Enter an amount greater than zero.",
  REASON_REQUIRED: "Please give a reason.",
};

/** Turns a Postgres exception raised by our RPC functions into a friendly sentence. */
export function friendlyError(error: { message?: string } | null | undefined) {
  const msg = error?.message ?? "";
  const dup = /ALREADY_REGISTERED(?::(\S+))?/.exec(msg);
  if (dup) {
    return dup[1]
      ? `This phone number is already registered (reference ${dup[1]}). Use “Check my registration” to see its status.`
      : "This phone number already has an active registration.";
  }
  const code = Object.keys(MESSAGES).find((k) => msg.includes(k));
  return code ? MESSAGES[code] : "Something went wrong. Please try again.";
}
