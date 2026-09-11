import { authorizeNetEnabled } from "../config.js";
import {
  addPaymentProfile,
  createCustomerProfile,
  updatePaymentProfile,
} from "./authorizeNet.js";

export type MemberCardDoc = {
  _id: unknown;
  memberNumber?: string;
  email?: string;
  firstName: string;
  lastName: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  authnetCustomerProfileId?: string;
  authnetPaymentProfileId?: string;
  authnetCardLast4?: string;
  authnetCardExpiry?: string;
  paymentMethod?: string;
  autoRenew?: boolean;
};

export type StoreCardInput = {
  cardNumber: string;
  expiration: string;
  cvv: string;
};

export type StoreCardResult =
  | { ok: true; cardLast4: string; customerProfileId: string; paymentProfileId: string }
  | { ok: false; error: string };

/**
 * Vault a card with Authorize.Net CIM and write only profile ids / last 4 onto the member.
 * Does not persist the PAN. Caller must save the member document.
 */
export async function storeCardOnFile(
  member: MemberCardDoc,
  input: StoreCardInput
): Promise<StoreCardResult> {
  if (!authorizeNetEnabled) {
    return { ok: false, error: "Card storage is not configured. Please contact the office." };
  }

  const cardNumber = input.cardNumber.replace(/\s+/g, "");
  const billing = {
    firstName: member.firstName,
    lastName: member.lastName,
    addressLine1: member.addressLine1,
    city: member.city,
    state: member.state,
    postalCode: member.postalCode,
  };

  let customerProfileId = member.authnetCustomerProfileId || "";
  if (!customerProfileId) {
    const profileResult = await createCustomerProfile({
      merchantCustomerId: member.memberNumber || String(member._id),
      email: member.email || "",
      description: `${member.firstName} ${member.lastName}`,
    });
    if (!profileResult.ok) {
      return { ok: false, error: profileResult.error };
    }
    customerProfileId = profileResult.customerProfileId;
  }

  let paymentResult;
  if (member.authnetPaymentProfileId) {
    paymentResult = await updatePaymentProfile({
      customerProfileId,
      paymentProfileId: member.authnetPaymentProfileId,
      cardNumber,
      expirationDate: input.expiration,
      cardCode: input.cvv,
      ...billing,
    });
    if (!paymentResult.ok) {
      paymentResult = await addPaymentProfile({
        customerProfileId,
        cardNumber,
        expirationDate: input.expiration,
        cardCode: input.cvv,
        ...billing,
      });
    }
  } else {
    paymentResult = await addPaymentProfile({
      customerProfileId,
      cardNumber,
      expirationDate: input.expiration,
      cardCode: input.cvv,
      ...billing,
    });
  }

  if (!paymentResult.ok) {
    return { ok: false, error: paymentResult.error };
  }

  member.authnetCustomerProfileId = customerProfileId;
  member.authnetPaymentProfileId = paymentResult.paymentProfileId;
  member.authnetCardLast4 = paymentResult.cardLast4;
  member.authnetCardExpiry = input.expiration.replace(/\D/g, "");
  member.paymentMethod = "card";
  member.autoRenew = true;

  return {
    ok: true,
    cardLast4: paymentResult.cardLast4,
    customerProfileId,
    paymentProfileId: paymentResult.paymentProfileId,
  };
}
