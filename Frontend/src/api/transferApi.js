import { apiRequest } from "./client";

export const BANKS = [
  { code: "058", name: "Nexora Bank" },
  { code: "260", name: "PHC Bank" },
  { code: "703", name: "Test Bank" },
  { code: "000001", name: "Test Bank" },
];

export async function nameEnquiry({ accountNumber, bankCode, isInterBank = false }) {
  const result = await apiRequest({
    path: "/api/transfers/name-enquiry",
    method: "POST",
    body: {
      bankCode,
      accountNumber,
      isInterBank,
    },
  });

  return {
    accountNumber: result.accountNumber,
    accountName: result.accountName,
    bankName: BANKS.find((bank) => bank.code === result.bankCode)?.name || "Bank",
  };
}

export async function transferFunds({
  transferType,
  fromAccount,
  toAccount,
  toAccountName,
  toBankCode,
  toBankName,
  amount,
  narration,
}) {
  const path = transferType === "INTER_BANK" ? "/api/transfers/interbank" : "/api/transfers";
  const body = transferType === "INTER_BANK"
    ? {
        recipientBank: toBankCode,
        recipientAccountNumber: toAccount,
        amount: Number(amount),
        idempotencyKey: `${Date.now()}`,
      }
    : {
        recipientAccountNumber: toAccount,
        amount: Number(amount),
      };

  const result = await apiRequest({
    path,
    method: "POST",
    body,
  });

  return {
    reference: result.transfer?.reference || result.reference,
    status: result.transfer?.status || result.status,
    amount: Number(result.transfer?.amount || result.amount || amount),
    toAccountName: toAccountName || result.transfer?.recipientName || "Recipient",
    toBankName: toBankName || null,
    date: new Date().toISOString(),
  };
}
