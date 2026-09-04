const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Digital Banking System API',
      version: '1.0.0',
      description: 'Complete API documentation for the Digital Banking System backend. Supports authentication, onboarding, account management, transfers, and transaction history.',
      contact: {
        name: 'Banking Team',
        email: 'support@digitalbanking.local',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token required for protected endpoints. Obtain via login endpoint.',
        },
      },
      schemas: {
        // Auth Schemas
        Credentials: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
              description: 'User email address',
            },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 128,
              example: 'CorrectHorseBattery123!',
              description: 'User password (minimum 8 characters)',
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              minLength: 20,
              example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
              description: 'Refresh token obtained from login',
            },
          },
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
              description: 'Email address for password reset',
            },
          },
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'password'],
          properties: {
            token: {
              type: 'string',
              minLength: 20,
              example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
              description: 'Reset token from forgot-password endpoint',
            },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 128,
              example: 'NewPassword123!',
              description: 'New password (minimum 8 characters)',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'ObjectId',
              example: '507f1f77bcf86cd799439011',
              description: 'User unique identifier',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-08-30T10:30:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-08-30T10:30:00.000Z',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT access token (valid for 1 hour)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refreshToken: {
              type: 'string',
              description: 'Refresh token for obtaining new access tokens',
              example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        // Onboarding Schemas
        BVNRequest: {
          type: 'object',
          required: ['bvn'],
          properties: {
            bvn: {
              type: 'string',
              pattern: '^\\d{11}$',
              example: '12345678901',
              description: 'Bank Verification Number (11 digits)',
            },
          },
        },
        NINRequest: {
          type: 'object',
          required: ['nin'],
          properties: {
            nin: {
              type: 'string',
              pattern: '^\\d{11}$',
              example: '12345678901',
              description: 'National Identification Number (11 digits)',
            },
          },
        },
        VerificationResult: {
          type: 'object',
          properties: {
            verificationType: {
              type: 'string',
              enum: ['BVN', 'NIN'],
              example: 'BVN',
            },
            onboardingStatus: {
              type: 'string',
              enum: ['VERIFIED', 'PENDING', 'FAILED'],
              example: 'VERIFIED',
            },
            verifiedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-08-30T10:30:00.000Z',
            },
          },
        },
        // Account Schemas
        CreateAccountRequest: {
          type: 'object',
          required: ['kycType', 'kycID', 'dob'],
          properties: {
            kycType: {
              type: 'string',
              enum: ['bvn', 'nin', 'BVN', 'NIN'],
              example: 'BVN',
              description: 'KYC document type',
            },
            kycID: {
              type: 'string',
              pattern: '^\\d{11}$',
              example: '12345678901',
              description: 'KYC document number (11 digits)',
            },
            dob: {
              type: 'string',
              format: 'date',
              example: '1990-01-15',
              description: 'Date of birth (ISO 8601 format)',
            },
          },
        },
        Account: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'ObjectId',
              example: '507f1f77bcf86cd799439011',
            },
            accountNumber: {
              type: 'string',
              pattern: '^\\d{10}$',
              example: '7031234567',
              description: 'Bank account number (10 digits)',
            },
            accountName: {
              type: 'string',
              example: 'John Doe',
              description: 'Account holder name',
            },
            bankCode: {
              type: 'string',
              example: '703',
              description: 'Bank code',
            },
            currency: {
              type: 'string',
              enum: ['NGN'],
              example: 'NGN',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
              example: 'ACTIVE',
            },
            balance: {
              type: 'integer',
              example: 15000,
              description: 'Account balance in minor currency units (kobo)',
            },
            customerId: {
              type: 'string',
              format: 'ObjectId',
              example: '507f1f77bcf86cd799439011',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-08-30T10:30:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-08-30T10:30:00.000Z',
            },
          },
        },
        AccountBalance: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              format: 'ObjectId',
              example: '507f1f77bcf86cd799439011',
            },
            accountNumber: {
              type: 'string',
              pattern: '^\\d{10}$',
              example: '7031234567',
            },
            balance: {
              type: 'integer',
              example: 15000,
              description: 'Balance in minor currency units (kobo)',
            },
            currency: {
              type: 'string',
              example: 'NGN',
            },
          },
        },
        // Transfer Schemas
        NameEnquiryRequest: {
          type: 'object',
          required: ['bankCode', 'accountNumber'],
          properties: {
            bankCode: {
              type: 'string',
              pattern: '^\\d{3,6}$',
              example: '703',
              description: 'Recipient bank code (3-6 digits)',
            },
            accountNumber: {
              type: 'string',
              pattern: '^\\d{10}$',
              example: '0123456789',
              description: 'Recipient account number (10 digits)',
            },
            isInterBank: {
              type: 'boolean',
              default: false,
              example: true,
              description: 'Select the external-bank TEST_MODE lookup branch when true',
            },
          },
        },
        NameEnquiryResponse: {
          type: 'object',
          properties: {
            accountName: {
              type: 'string',
              example: 'Jane Doe',
              description: 'Name associated with the account',
            },
            accountNumber: {
              type: 'string',
              example: '0123456789',
            },
            bankCode: {
              type: 'string',
              example: '703',
            },
          },
        },
        IntraBankTransferRequest: {
          type: 'object',
          required: ['amount'],
          oneOf: [
            { required: ['recipientAccountId'] },
            { required: ['recipientAccountNumber'] },
          ],
          properties: {
            recipientAccountId: {
              type: 'string',
              format: 'ObjectId',
              example: '507f1f77bcf86cd799439011',
              description: 'Recipient account ID (internal account)',
            },
            recipientAccountNumber: {
              type: 'string',
              pattern: '^\\d{10}$',
              example: '7037654321',
              description: 'Recipient account number (10 digits)',
            },
            amount: {
              type: 'integer',
              minimum: 1,
              example: 5000,
              description: 'Transfer amount in minor currency units (kobo)',
            },
          },
        },
        InterBankTransferRequest: {
          type: 'object',
          required: ['recipientBank', 'recipientAccountNumber', 'amount'],
          properties: {
            recipientBank: {
              type: 'string',
              pattern: '^\\d{3,6}$',
              example: '000001',
              description: 'Recipient bank code (3-6 digits)',
            },
            recipientAccountNumber: {
              type: 'string',
              pattern: '^\\d{10}$',
              example: '0123456789',
              description: 'Recipient account number (10 digits)',
            },
            amount: {
              type: 'integer',
              minimum: 1,
              example: 5000,
              description: 'Transfer amount in minor currency units (kobo)',
            },
            idempotencyKey: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
              example: 'transfer-unique-key-2026-08-30',
              description: 'Unique key to prevent duplicate transfers (optional)',
            },
          },
        },
        TransferResult: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'ObjectId',
              example: '507f1f77bcf86cd799439011',
            },
            reference: {
              type: 'string',
              example: 'TRF-a1b2c3d4-e5f6-47a8-b9c0-d1e2f3g4h5i6',
              description: 'Unique transfer reference',
            },
            fromAccountId: {
              type: 'string',
              format: 'ObjectId',
            },
            toAccountId: {
              type: 'string',
              format: 'ObjectId',
            },
            recipientAccountNumber: {
              type: 'string',
              example: '0123456789',
            },
            recipientBank: {
              type: 'string',
              example: '000001',
            },
            amount: {
              type: 'integer',
              example: 5000,
            },
            type: {
              type: 'string',
              enum: ['DEBIT', 'CREDIT'],
              example: 'DEBIT',
            },
            transferType: {
              type: 'string',
              enum: ['INTRA_BANK', 'INTER_BANK'],
              example: 'INTRA_BANK',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'SUCCESS', 'FAILED'],
              example: 'SUCCESS',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        // Transaction Schemas
        Transaction: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'ObjectId',
              example: '507f1f77bcf86cd799439011',
            },
            reference: {
              type: 'string',
              example: 'TRF-a1b2c3d4-e5f6-47a8-b9c0-d1e2f3g4h5i6',
            },
            fromAccountId: {
              type: 'string',
              format: 'ObjectId',
            },
            toAccountId: {
              type: 'string',
              format: 'ObjectId',
            },
            amount: {
              type: 'integer',
              example: 5000,
            },
            type: {
              type: 'string',
              enum: ['DEBIT', 'CREDIT', 'INITIAL_FUNDING'],
            },
            transferType: {
              type: 'string',
              enum: ['INTRA_BANK', 'INTER_BANK', 'INITIAL_FUNDING'],
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'SUCCESS', 'FAILED', 'UNKNOWN'],
            },
            currency: {
              type: 'string',
              example: 'NGN',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        TransactionHistory: {
          type: 'object',
          properties: {
            transactions: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Transaction',
              },
            },
            pagination: {
              type: 'object',
              properties: {
                currentPage: {
                  type: 'integer',
                  example: 1,
                },
                pageSize: {
                  type: 'integer',
                  example: 20,
                },
                totalTransactions: {
                  type: 'integer',
                  example: 100,
                },
                totalPages: {
                  type: 'integer',
                  example: 5,
                },
                hasMore: {
                  type: 'boolean',
                  example: true,
                },
              },
            },
          },
        },
        // Error Schemas
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Invalid request body',
            },
            details: {
              type: 'array',
              items: {
                type: 'string',
              },
              nullable: true,
              example: ['email'],
            },
          },
        },
        // Generic success response
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Request successful',
            },
            data: {
              type: 'object',
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    paths: {
      '/api/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user',
          description: 'Create a new user account with email and password',
          operationId: 'registerUser',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Credentials',
                },
                example: {
                  email: 'newuser@example.com',
                  password: 'SecurePassword123!',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'User registered successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Registration successful',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          user: {
                            $ref: '#/components/schemas/User',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid input (email already exists, invalid format, etc.)',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            409: {
              description: 'Email already registered',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                  example: {
                    success: false,
                    message: 'An account with that email already exists',
                    statusCode: 409,
                    data: null,
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [],
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login user',
          description: 'Authenticate user with email and password. Rate-limited to prevent brute force attacks.',
          operationId: 'loginUser',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Credentials',
                },
                example: {
                  email: 'user@example.com',
                  password: 'SecurePassword123!',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful. Returns access token and refresh token.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Login successful',
                      },
                      data: {
                        $ref: '#/components/schemas/AuthResponse',
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Invalid credentials or account locked after failed attempts',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            429: {
              description: 'Too many login attempts. Rate limited.',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [],
        },
      },
      '/api/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh access token',
          description: 'Obtain a new access token using a valid refresh token. Refresh tokens are rotated on use.',
          operationId: 'refreshToken',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RefreshTokenRequest',
                },
                example: {
                  refreshToken: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Token refreshed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Token refreshed successfully',
                      },
                      data: {
                        $ref: '#/components/schemas/AuthResponse',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Refresh token is required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Invalid or expired refresh token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [],
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Authentication'],
          summary: 'Logout user',
          description: 'Invalidate the refresh token and end the user session',
          operationId: 'logoutUser',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/RefreshTokenRequest',
                },
                example: {
                  refreshToken: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Logout successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Logout successful',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          revoked: {
                            type: 'boolean',
                            example: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Refresh token is required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Invalid refresh token',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [],
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Request password reset',
          description: 'Request a password reset link. Does not reveal if email exists for security.',
          operationId: 'forgotPassword',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ForgotPasswordRequest',
                },
                example: {
                  email: 'user@example.com',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Password reset request processed successfully (always returns same message for security)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'If an account exists for that email, a password reset link has been sent.',
                      },
                      data: {
                        type: 'null',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid email format',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [],
        },
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Authentication'],
          summary: 'Reset password',
          description: 'Reset password using a valid reset token. Invalidates all active sessions.',
          operationId: 'resetPassword',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ResetPasswordRequest',
                },
                example: {
                  token: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
                  password: 'NewSecurePassword123!',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Password reset successful. All sessions invalidated.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Password reset successful',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          passwordReset: {
                            type: 'boolean',
                            example: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid or expired reset token / invalid password',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [],
        },
      },
      '/api/onboarding/bvn': {
        post: {
          tags: ['Onboarding'],
          summary: 'Verify with BVN',
          description: 'Verify customer identity using Bank Verification Number (BVN)',
          operationId: 'verifyBvn',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/BVNRequest',
                },
                example: {
                  bvn: '12345678901',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'BVN verification successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'BVN verification successful',
                      },
                      data: {
                        $ref: '#/components/schemas/VerificationResult',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid BVN format or verification failed',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            409: {
              description: 'Customer already verified or verification in progress',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error or external service failure',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/onboarding/nin': {
        post: {
          tags: ['Onboarding'],
          summary: 'Verify with NIN',
          description: 'Verify customer identity using National Identification Number (NIN)',
          operationId: 'verifyNin',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/NINRequest',
                },
                example: {
                  nin: '12345678901',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'NIN verification successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'NIN verification successful',
                      },
                      data: {
                        $ref: '#/components/schemas/VerificationResult',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid NIN format or verification failed',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            409: {
              description: 'Customer already verified or verification in progress',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error or external service failure',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/account/create': {
        post: {
          tags: ['Account'],
          summary: 'Create a new bank account',
          description: 'Create a new bank account after BVN/NIN verification. Account receives ₦15,000 initial funding.',
          operationId: 'createAccount',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CreateAccountRequest',
                },
                example: {
                  kycType: 'BVN',
                  kycID: '12345678901',
                  dob: '1990-01-15',
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Account created successfully with ₦15,000 initial funding',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Account created successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          account: {
                            $ref: '#/components/schemas/Account',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid input',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'Customer not verified or not eligible to create an account',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Customer not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            409: {
              description: 'Account already exists for this customer',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            503: {
              description: 'Account creation temporarily unavailable',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/account/me': {
        get: {
          tags: ['Account'],
          summary: 'Get authenticated user account',
          description: 'Retrieve the account details for the authenticated user',
          operationId: 'getMyAccount',
          responses: {
            200: {
              description: 'Account retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Account retrieved successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          account: {
                            $ref: '#/components/schemas/Account',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Account not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/account/{accountId}': {
        get: {
          tags: ['Account'],
          summary: 'Get account details',
          description: 'Retrieve account details. User can only access their own account (IDOR protected).',
          operationId: 'getAccount',
          parameters: [
            {
              name: 'accountId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'ObjectId',
              },
              description: 'Account ID (MongoDB ObjectId)',
              example: '507f1f77bcf86cd799439011',
            },
          ],
          responses: {
            200: {
              description: 'Account retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Account retrieved successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          account: {
                            $ref: '#/components/schemas/Account',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid account ID format',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'You do not have access to this account',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Account not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/account/{accountId}/balance': {
        get: {
          tags: ['Account'],
          summary: 'Get account balance',
          description: 'Retrieve the current balance for an account. User can only access their own account.',
          operationId: 'getBalance',
          parameters: [
            {
              name: 'accountId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'ObjectId',
              },
              description: 'Account ID (MongoDB ObjectId)',
              example: '507f1f77bcf86cd799439011',
            },
          ],
          responses: {
            200: {
              description: 'Balance retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Balance retrieved successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          account: {
                            $ref: '#/components/schemas/AccountBalance',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid account ID format',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'You do not have access to this account',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Account not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/account/balance/{accountId}': {
        get: {
          tags: ['Account'],
          summary: 'Get account balance (alternate endpoint)',
          description: 'Retrieve account balance using alternate path format',
          operationId: 'getBalanceAlternate',
          parameters: [
            {
              name: 'accountId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                format: 'ObjectId',
              },
              description: 'Account ID (MongoDB ObjectId)',
              example: '507f1f77bcf86cd799439011',
            },
          ],
          responses: {
            200: {
              description: 'Balance retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Balance retrieved successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          account: {
                            $ref: '#/components/schemas/AccountBalance',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid account ID format',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'You do not have access to this account',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Account not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/transfers': {
        post: {
          tags: ['Transfer'],
          summary: 'Create intra-bank transfer',
          description: 'Transfer funds to another account within the same bank. Supports concurrent transfer protection.',
          operationId: 'createTransfer',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/IntraBankTransferRequest',
                },
                example: {
                  recipientAccountId: '507f1f77bcf86cd799439011',
                  amount: 5000,
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Transfer completed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Transfer completed successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          transfer: {
                            $ref: '#/components/schemas/TransferResult',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid input or insufficient funds',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'Account or recipient account is blocked',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Account or recipient not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/transfers/interbank': {
        post: {
          tags: ['Transfer'],
          summary: 'Create inter-bank transfer',
          description: 'Transfer funds to an account in another bank. Supports idempotency with optional idempotencyKey.',
          operationId: 'createInterBankTransfer',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/InterBankTransferRequest',
                },
                example: {
                  recipientBank: '000001',
                  recipientAccountNumber: '0123456789',
                  amount: 5000,
                  idempotencyKey: 'transfer-unique-key-2026-08-30',
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Inter-bank transfer processed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Inter-bank transfer processed successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          transfer: {
                            $ref: '#/components/schemas/TransferResult',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid input or insufficient funds',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'Account is blocked',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Account not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/transfers/name-enquiry': {
        post: {
          tags: ['Transfer'],
          summary: 'Name enquiry',
          description: 'Look up the account name for a recipient account. Rate-limited to prevent abuse.',
          operationId: 'nameEnquiry',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/NameEnquiryRequest',
                },
                example: {
                  bankCode: '703',
                  accountNumber: '0123456789',
                  isInterBank: false,
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Name enquiry successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Recipient name retrieved successfully',
                      },
                      data: {
                        $ref: '#/components/schemas/NameEnquiryResponse',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid bank code or account number format',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Account not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            429: {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error or name enquiry service unavailable',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/transfers/status/{transactionId}': {
        get: {
          tags: ['Transfer'],
          summary: 'Get transaction status',
          description: 'Retrieve the status of a transfer. Optionally include external NIBSS status for inter-bank transfers.',
          operationId: 'getTransactionStatus',
          parameters: [
            {
              name: 'transactionId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                description: 'MongoDB ObjectId or transaction reference',
              },
              description: 'Transaction ID',
              example: '507f1f77bcf86cd799439011',
            },
            {
              name: 'includeExternalStatus',
              in: 'query',
              required: false,
              schema: {
                type: 'boolean',
                default: false,
              },
              description: 'Include external NIBSS status for inter-bank transfers',
              example: false,
            },
          ],
          responses: {
            200: {
              description: 'Transaction status retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Transaction status retrieved successfully',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          transaction: {
                            $ref: '#/components/schemas/Transaction',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid transaction ID format',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            403: {
              description: 'You do not have access to this transaction',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            404: {
              description: 'Transaction not found',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
      '/api/transactions/history': {
        get: {
          tags: ['Transaction'],
          summary: 'Get transaction history',
          description: 'Retrieve paginated transaction history for the authenticated user with optional filtering and sorting',
          operationId: 'getTransactionHistory',
          parameters: [
            {
              name: 'page',
              in: 'query',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                default: 1,
              },
              description: 'Page number (starts at 1)',
              example: 1,
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                default: 20,
              },
              description: 'Number of transactions per page',
              example: 20,
            },
            {
              name: 'type',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['CREDIT', 'DEBIT', 'INITIAL_FUNDING'],
              },
              description: 'Filter by transaction type',
              example: 'CREDIT',
            },
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['PENDING', 'SUCCESS', 'FAILED', 'UNKNOWN'],
              },
              description: 'Filter by transaction status',
              example: 'SUCCESS',
            },
            {
              name: 'from',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                format: 'date-time',
              },
              description: 'Filter transactions from this date (ISO 8601)',
              example: '2026-01-01T00:00:00Z',
            },
            {
              name: 'to',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                format: 'date-time',
              },
              description: 'Filter transactions until this date (ISO 8601)',
              example: '2026-08-30T23:59:59Z',
            },
            {
              name: 'sort',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['createdAt', 'amount'],
                default: 'createdAt',
              },
              description: 'Sort by field',
              example: 'createdAt',
            },
            {
              name: 'direction',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
              },
              description: 'Sort direction',
              example: 'desc',
            },
          ],
          responses: {
            200: {
              description: 'Transaction history retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Transaction history retrieved successfully',
                      },
                      data: {
                        $ref: '#/components/schemas/TransactionHistory',
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid query parameters',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                },
              },
            },
          },
          security: [
            {
              BearerAuth: [],
            },
          ],
        },
      },
    },
  },
  apis: [],
};

const specs = swaggerJsdoc(options);

for (const pathItem of Object.values(specs.paths)) {
  for (const operation of Object.values(pathItem)) {
    for (const response of Object.values(operation.responses || {})) {
      const json = response.content && response.content['application/json'];
      if (!json || json.example) {
        continue;
      }

      const isSuccess = response.description.toLowerCase().includes('success')
        || response.description.toLowerCase().includes('retrieved')
        || response.description.toLowerCase().includes('completed')
        || response.description.toLowerCase().includes('processed');

      json.example = isSuccess
        ? {
          success: true,
          message: response.description,
          data: {},
        }
        : {
          success: false,
          message: response.description,
        };
    }
  }
}

module.exports = specs;
