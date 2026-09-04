# Digital Banking System — Backend

A Node.js + Express backend implementing core banking functionality with MongoDB persistence, JWT authentication, and NIBSS integration (TEST_MODE supported).

## Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB (local or remote connection string in `.env`)

### Installation
```bash
cd Backend
npm install
```

### Running the Server
```bash
$env:TEST_MODE = "true"  # Enable controlled NIBSS mocks
npm start
```

Server runs on `localhost:3000`.

## Testing

### Run Full E2E Suite
```bash
cd Backend
node tests/e2e-full-suite.js
```

Runs 32 sequential tests with dependencies:
- ✅ Auth (registration, login, duplicate prevention)
- ✅ Onboarding (BVN/NIN verification)
- ✅ Account creation (single-account rule)
- ✅ Balance queries (authorization checks)
- ✅ Intra-bank transfers (sufficient funds validation)
- ✅ Inter-bank transfers (in TEST_MODE)
- ✅ Transaction history & status queries
- ✅ Cross-user IDOR rejection tests (balance, transaction status, account details)

**Test Mode:** Uses `TEST_MODE=true` environment variable to inject controlled NIBSS mock responses instead of calling real endpoints. Database operations are real (MongoDB). TEST_MODE validates business logic and mock response handling, but it does not validate real NIBSS request/response contracts; any change to the NIBSS integration layer must be re-verified against the live sandbox before considering the integration complete.

## Architecture

```
src/
  ├── routes/        # Express route handlers
  ├── controllers/   # Request handling logic
  ├── services/      # Business logic (transfers, onboarding, etc.)
  ├── models/        # Mongoose schemas (User, Customer, Account, Transaction)
  ├── middleware/    # Auth, validation, rate limiting
  ├── integrations/  # NIBSS integration layer
  ├── validators/    # Joi schemas for input validation
  ├── utils/         # Helpers (error handling, responses)
  ├── config/        # Database, environment, logger setup
  └── app.js         # Express app initialization
```

## Key Endpoints

### Auth
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login, returns JWT token

### Onboarding
- `POST /api/onboarding/bvn` — Verify BVN
- `POST /api/onboarding/nin` — Verify NIN

### Accounts
- `POST /api/account/create` — Create account (after onboarding)
- `GET /api/account/balance/:accountId` — Get balance (owner only)
- `GET /api/account/:accountId` — Get account details (owner only)

### Transfers
- `POST /api/transfers` — Intra-bank transfer
- `POST /api/transfers/interbank` — Inter-bank transfer
- `POST /api/transfers/name-enquiry` — Look up recipient account name
- `GET /api/transfers/status/:transactionId` — Query transfer status (owner only)

### Transactions
- `GET /api/transactions/history` — Get transaction history (authenticated user's data only)

## Security

### Authorization
- JWT-based auth via `request.user.sub` (extracted from token)
- All ID-based endpoints check ownership before returning data:
  - **Balance query** (Test 15): User B cannot read User A's balance → 403
  - **Account details** (Test 13B): User B cannot read User A's account → 403
  - **Transaction status** (Test 25B): User B cannot read User A's transaction → 403
  - **Transaction history**: User B automatically sees only User B's transactions (no ID param to override)

### Known Limitations
- **Transaction history endpoint:** Uses authenticated user context only; does NOT accept userId/accountId targeting parameters. To test cross-user rejection, endpoint would need redesign (e.g., `GET /api/transactions/history?userId=OTHER_USER_ID`).

## Known Issues / TODO

- Real NIBSS integration not yet tested (TEST_MODE mocks only)
- No frontend integration testing (backend E2E suite only)
- No concurrency testing (simultaneous requests)
- No production database testing (local MongoDB only)

## Environment Variables

Copy `Backend/.env.example` to `Backend/.env` and set local values before starting the server.

## Notes

- Account creation requires prior BVN/NIN onboarding verification
- Each customer can have only ONE account
- Initial account funding: 15,000 NGN
- Intra-bank transfers are immediate; inter-bank transfers depend on NIBSS processing
