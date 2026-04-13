/**
 * Authorize.Net payment gateway — thin wrapper over the "AIM" JSON API.
 *
 * We avoid pulling in the official SDK: it has a large dep footprint and the
 * Accept/AIM JSON endpoint works fine with fetch. Set:
 *   AUTHNET_LOGIN_ID         — API login ID from Authorize.Net merchant portal
 *   AUTHNET_TRANSACTION_KEY  — transaction key from merchant portal
 *   AUTHNET_ENV              — "sandbox" (default) or "production"
 *
 * All card data must flow straight from the admin UI to this backend and is
 * NEVER persisted. Only the auth response details (transaction id, last 4,
 * auth code) are stored on the BillingEvent for reconciliation.
 */
import { config, authorizeNetEnabled } from "../config.js";

const SANDBOX_URL = "https://apitest.authorize.net/xml/v1/request.api";
const PROD_URL = "https://api.authorize.net/xml/v1/request.api";

function endpoint(): string {
  return config.authorizeNet.env === "production" ? PROD_URL : SANDBOX_URL;
}

function auth() {
  return {
    merchantAuthentication: {
      name: config.authorizeNet.loginId,
      transactionKey: config.authorizeNet.transactionKey,
    },
  };
}

export type ChargeCardInput = {
  amountCents: number;
  cardNumber: string;
  expiration: string; // "MMYY" or "MM/YY"
  cardCode: string; // CVV
  invoiceNumber?: string;
  description?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type ChargeCardResult =
  | {
      ok: true;
      transactionId: string;
      authCode: string;
      accountLast4: string;
      accountType: string;
      amountCents: number;
      raw: unknown;
    }
  | { ok: false; error: string; raw?: unknown };

function normalizeExp(exp: string): string {
  const s = exp.replace(/\D/g, "");
  if (s.length === 4) return `${s.slice(0, 2)}${s.slice(2)}`;
  return s;
}

/** Charge a card one-time (sale). Returns a structured result. */
export async function chargeCard(input: ChargeCardInput): Promise<ChargeCardResult> {
  if (!authorizeNetEnabled) {
    return { ok: false, error: "authorize_net_not_configured" };
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "invalid_amount" };
  }
  const amountDollars = (input.amountCents / 100).toFixed(2);

  const body = {
    createTransactionRequest: {
      ...auth(),
      refId: Date.now().toString().slice(-10),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: amountDollars,
        payment: {
          creditCard: {
            cardNumber: input.cardNumber.replace(/\s+/g, ""),
            expirationDate: normalizeExp(input.expiration),
            cardCode: input.cardCode,
          },
        },
        order: input.invoiceNumber
          ? { invoiceNumber: input.invoiceNumber, description: input.description || "" }
          : undefined,
        customer: input.email ? { email: input.email } : undefined,
        billTo: {
          firstName: input.firstName || "",
          lastName: input.lastName || "",
          address: input.addressLine1 || "",
          city: input.city || "",
          state: input.state || "",
          zip: input.postalCode || "",
          country: "USA",
        },
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `network_error: ${String(e)}` };
  }

  // Authorize.Net responses have a UTF-8 BOM we need to strip before JSON.parse.
  const text = (await res.text()).replace(/^\uFEFF/, "");
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json_response", raw: text };
  }

  const tr = json.transactionResponse || {};
  const messages = json.messages || {};
  const resultCode = messages.resultCode;

  if (tr.responseCode !== "1" || resultCode !== "Ok") {
    const errText =
      tr.errors?.error?.[0]?.errorText ||
      messages.message?.[0]?.text ||
      "charge_declined";
    return { ok: false, error: String(errText), raw: json };
  }

  return {
    ok: true,
    transactionId: String(tr.transId || ""),
    authCode: String(tr.authCode || ""),
    accountLast4: String(tr.accountNumber || "").replace(/[^0-9]/g, "").slice(-4),
    accountType: String(tr.accountType || ""),
    amountCents: input.amountCents,
    raw: json,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CIM (Customer Information Manager) — Store cards and charge on file
// ─────────────────────────────────────────────────────────────────────────────

export type CreateCustomerProfileInput = {
  merchantCustomerId: string; // Your internal member ID or number
  email: string;
  description?: string;
};

export type CreateCustomerProfileResult =
  | { ok: true; customerProfileId: string }
  | { ok: false; error: string; raw?: unknown };

/** Create a customer profile in Authorize.Net CIM */
export async function createCustomerProfile(
  input: CreateCustomerProfileInput
): Promise<CreateCustomerProfileResult> {
  if (!authorizeNetEnabled) {
    return { ok: false, error: "authorize_net_not_configured" };
  }

  const body = {
    createCustomerProfileRequest: {
      ...auth(),
      profile: {
        merchantCustomerId: input.merchantCustomerId,
        email: input.email,
        description: input.description || "",
      },
    },
  };

  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = (await res.text()).replace(/^\uFEFF/, "");
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json_response", raw: text };
  }

  const messages = json.messages || {};
  if (messages.resultCode !== "Ok") {
    // Check if profile already exists (E00039)
    const errCode = messages.message?.[0]?.code;
    if (errCode === "E00039" && json.customerProfileId) {
      return { ok: true, customerProfileId: String(json.customerProfileId) };
    }
    return {
      ok: false,
      error: messages.message?.[0]?.text || "create_profile_failed",
      raw: json,
    };
  }

  return { ok: true, customerProfileId: String(json.customerProfileId) };
}

export type AddPaymentProfileInput = {
  customerProfileId: string;
  cardNumber: string;
  expirationDate: string; // "MMYY" or "MM/YY"
  cardCode: string;
  firstName: string;
  lastName: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type AddPaymentProfileResult =
  | { ok: true; paymentProfileId: string; cardLast4: string }
  | { ok: false; error: string; raw?: unknown };

/** Add a payment profile (credit card) to an existing customer profile */
export async function addPaymentProfile(
  input: AddPaymentProfileInput
): Promise<AddPaymentProfileResult> {
  if (!authorizeNetEnabled) {
    return { ok: false, error: "authorize_net_not_configured" };
  }

  const body = {
    createCustomerPaymentProfileRequest: {
      ...auth(),
      customerProfileId: input.customerProfileId,
      paymentProfile: {
        billTo: {
          firstName: input.firstName,
          lastName: input.lastName,
          address: input.addressLine1 || "",
          city: input.city || "",
          state: input.state || "",
          zip: input.postalCode || "",
          country: "USA",
        },
        payment: {
          creditCard: {
            cardNumber: input.cardNumber.replace(/\s+/g, ""),
            expirationDate: normalizeExp(input.expirationDate),
            cardCode: input.cardCode,
          },
        },
        defaultPaymentProfile: true,
      },
      validationMode: config.authorizeNet.env === "production" ? "liveMode" : "testMode",
    },
  };

  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = (await res.text()).replace(/^\uFEFF/, "");
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json_response", raw: text };
  }

  const messages = json.messages || {};
  if (messages.resultCode !== "Ok") {
    return {
      ok: false,
      error: messages.message?.[0]?.text || "add_payment_profile_failed",
      raw: json,
    };
  }

  return {
    ok: true,
    paymentProfileId: String(json.customerPaymentProfileId),
    cardLast4: input.cardNumber.replace(/\D/g, "").slice(-4),
  };
}

export type ChargeCustomerProfileInput = {
  customerProfileId: string;
  paymentProfileId: string;
  amountCents: number;
  invoiceNumber?: string;
  description?: string;
};

/** Charge a stored payment profile (card on file) */
export async function chargeCustomerProfile(
  input: ChargeCustomerProfileInput
): Promise<ChargeCardResult> {
  if (!authorizeNetEnabled) {
    return { ok: false, error: "authorize_net_not_configured" };
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "invalid_amount" };
  }

  const amountDollars = (input.amountCents / 100).toFixed(2);

  const body = {
    createTransactionRequest: {
      ...auth(),
      refId: Date.now().toString().slice(-10),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: amountDollars,
        profile: {
          customerProfileId: input.customerProfileId,
          paymentProfile: {
            paymentProfileId: input.paymentProfileId,
          },
        },
        order: input.invoiceNumber
          ? { invoiceNumber: input.invoiceNumber, description: input.description || "" }
          : undefined,
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, error: `network_error: ${String(e)}` };
  }

  const text = (await res.text()).replace(/^\uFEFF/, "");
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json_response", raw: text };
  }

  const tr = json.transactionResponse || {};
  const messages = json.messages || {};
  const resultCode = messages.resultCode;

  if (tr.responseCode !== "1" || resultCode !== "Ok") {
    const errText =
      tr.errors?.error?.[0]?.errorText ||
      messages.message?.[0]?.text ||
      "charge_declined";
    return { ok: false, error: String(errText), raw: json };
  }

  return {
    ok: true,
    transactionId: String(tr.transId || ""),
    authCode: String(tr.authCode || ""),
    accountLast4: String(tr.accountNumber || "").replace(/[^0-9]/g, "").slice(-4),
    accountType: String(tr.accountType || ""),
    amountCents: input.amountCents,
    raw: json,
  };
}

export type CreateProfileAndChargeInput = {
  merchantCustomerId: string;
  email: string;
  cardNumber: string;
  expirationDate: string;
  cardCode: string;
  firstName: string;
  lastName: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  amountCents: number;
  invoiceNumber?: string;
  description?: string;
};

export type CreateProfileAndChargeResult =
  | {
      ok: true;
      customerProfileId: string;
      paymentProfileId: string;
      cardLast4: string;
      transactionId: string;
      authCode: string;
    }
  | { ok: false; error: string; raw?: unknown };

/**
 * Create customer profile, add payment profile, and charge in one flow.
 * Used for new member signup with card payment.
 */
export async function createProfileAndCharge(
  input: CreateProfileAndChargeInput
): Promise<CreateProfileAndChargeResult> {
  // Step 1: Create customer profile
  const profileResult = await createCustomerProfile({
    merchantCustomerId: input.merchantCustomerId,
    email: input.email,
    description: `${input.firstName} ${input.lastName}`,
  });

  if (!profileResult.ok) {
    return { ok: false, error: profileResult.error, raw: profileResult.raw };
  }

  // Step 2: Add payment profile
  const paymentResult = await addPaymentProfile({
    customerProfileId: profileResult.customerProfileId,
    cardNumber: input.cardNumber,
    expirationDate: input.expirationDate,
    cardCode: input.cardCode,
    firstName: input.firstName,
    lastName: input.lastName,
    addressLine1: input.addressLine1,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
  });

  if (!paymentResult.ok) {
    return { ok: false, error: paymentResult.error, raw: paymentResult.raw };
  }

  // Step 3: Charge the card
  const chargeResult = await chargeCustomerProfile({
    customerProfileId: profileResult.customerProfileId,
    paymentProfileId: paymentResult.paymentProfileId,
    amountCents: input.amountCents,
    invoiceNumber: input.invoiceNumber,
    description: input.description,
  });

  if (!chargeResult.ok) {
    return { ok: false, error: chargeResult.error, raw: chargeResult.raw };
  }

  return {
    ok: true,
    customerProfileId: profileResult.customerProfileId,
    paymentProfileId: paymentResult.paymentProfileId,
    cardLast4: paymentResult.cardLast4,
    transactionId: chargeResult.transactionId,
    authCode: chargeResult.authCode,
  };
}

/** Refund a prior transaction (requires last 4 of original card). */
export async function refundTransaction(params: {
  transactionId: string;
  amountCents: number;
  cardLast4: string;
}): Promise<ChargeCardResult> {
  if (!authorizeNetEnabled) return { ok: false, error: "authorize_net_not_configured" };
  const body = {
    createTransactionRequest: {
      ...auth(),
      transactionRequest: {
        transactionType: "refundTransaction",
        amount: (params.amountCents / 100).toFixed(2),
        payment: { creditCard: { cardNumber: params.cardLast4, expirationDate: "XXXX" } },
        refTransId: params.transactionId,
      },
    },
  };
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = (await res.text()).replace(/^\uFEFF/, "");
  const json = JSON.parse(text);
  const tr = json.transactionResponse || {};
  if (tr.responseCode !== "1") {
    return { ok: false, error: tr.errors?.error?.[0]?.errorText || "refund_failed", raw: json };
  }
  return {
    ok: true,
    transactionId: String(tr.transId || ""),
    authCode: String(tr.authCode || ""),
    accountLast4: params.cardLast4,
    accountType: "",
    amountCents: params.amountCents,
    raw: json,
  };
}
