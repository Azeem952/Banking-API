import { apiRequest } from "./client";

export async function listTransactions({
  page = 1,
  limit = 6,
  type = "ALL",
  status = "ALL",
  from,
  to,
  search = "",
}) {
  const result = await apiRequest({
    path: "/api/transactions/history",
    method: "GET",
    query: {
      page,
      limit,
      type: type === "ALL" ? undefined : type,
      status: status === "ALL" ? undefined : status,
      from,
      to,
      sort: "createdAt",
      direction: "desc",
    },
  });

  return {
    items: (result.transactions || []).map((t) => ({
      reference: t.reference,
      type: t.type === "INITIAL_FUNDING" ? "FUNDING" : "TRANSFER",
      description: t.transferType === "INITIAL_FUNDING" ? "Initial Funding" : t.reference,
      amount: t.amount,
      direction: t.type === "CREDIT" || t.type === "INITIAL_FUNDING" ? "CREDIT" : "DEBIT",
      status: t.status,
      channel: "Mobile Banking",
      date: t.createdAt,
    })),
    page: result.pagination?.currentPage || page,
    limit: result.pagination?.pageSize || limit,
    totalCount: result.pagination?.totalTransactions || 0,
    totalPages: result.pagination?.totalPages || 1,
  };
}

export async function getTransactionByReference({ reference }) {
  const result = await apiRequest({
    path: "/api/transactions/history",
    method: "GET",
    query: { page: 1, limit: 100 },
  });

  const found = (result.transactions || []).find((t) => t.reference === reference);
  if (!found) {
    throw new Error("Transaction not found.");
  }

  return {
    reference: found.reference,
    amount: found.amount,
    type: found.type,
    description: found.transferType === "INITIAL_FUNDING" ? "Initial Funding" : found.reference,
    status: found.status,
    channel: "Mobile Banking",
    date: found.createdAt,
    fromAccount: found.fromAccountId,
    toAccount: found.toAccountId,
    toAccountName: found.recipientAccountNumber || "Recipient",
    toBankName: found.recipientBankCode || null,
    narration: "—",
    direction: found.type === "CREDIT" || found.type === "INITIAL_FUNDING" ? "CREDIT" : "DEBIT",
  };
}
