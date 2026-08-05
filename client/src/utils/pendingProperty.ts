export type PendingProperty = {
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
};

/** sessionStorage key for address carried from signup → /account after sign-in. */
export const PENDING_PROPERTY_KEY = "coop_pending_property";
