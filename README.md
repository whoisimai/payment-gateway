# Payment Gateway Backend Documentation

PayFast payment gateway backend application.

## Project Overview

**Application Name:** Backend Payment Gateway
**Purpose:** A TypeScript/Express-based payment processing backend that integrates with PayFast (South African payment processor) to handle payment initiation, verification, and webhook notifications.

**Tech Stack:**
- Runtime: Node.js with Express 5.1.0
- Language: TypeScript 5.8.3
- Key Dependencies: CORS 2.8.5, Axios 1.9.0, Dotenv 16.5.0
- Development Tools: ts-node-dev, npm scripts for build/dev/start

**Project Structure:**
```
payment-gateway/
├── src/
│   ├── index.ts (Main server entry point)
│   ├── controller/
│   │   └── payfast.ts (PayFast integration logic)
│   └── router/
│       └── router.ts (API routes)
├── test/
│   └── run.http (HTTP client tests)
├── package.json
├── tsconfig.json
└── .env (environment variables)
```

## Architecture & Design

### 1. System Architecture Section
Document the three-tier architecture:
- **Presentation Layer:** Express.js server handling HTTP requests
- **Business Logic Layer:** PayFast controller with payment processing and signature verification
- **External Integration Layer:** PayFast API and BulkSMSAPI (SMS notifications)

### 2. Core Workflows

**Payment Initiation Flow (POST /api/pay):**
- Client sends payment request with customer name, amount, item details, and order ID
- Backend constructs PayFast payment form data with merchant credentials
- Signature is generated (currently handled on client redirect side)
- Payment URL is returned for browser redirect to PayFast checkout

**Webhook/Notification Handler (POST /api/notify_url):**
- PayFast sends payment status notifications to this endpoint
- Payload includes: customer name, amount, item name, order ID, transaction details
- Request includes MD5 HMAC signature for verification
- Backend validates signature against PayFast's passphrase
- Server-to-server validation with PayFast using HTTPS POST
- SMS notification sent to predefined destination upon successful payment
- 200 OK response returned to acknowledge receipt

### 3. Payment Verification Strategy
- Dual verification approach: Client-side signature + Server-to-server validation
- MD5 hashing for signature generation
- Parameter order must be preserved (NOT sorted) per PayFast specification
- Passphrase appended to parameter string before hashing
- Integration with PayFast's /eng/query/validate endpoint

## Security Implementation & Recommendations

### Currently Implemented Security Measures:

**1. CORS Configuration:**
- CORS middleware enabled globally on all routes
- Benefit: Prevents unauthorized cross-origin requests from browsers
- Current Implementation: Default permissive mode (accepts all origins)
- **IMPROVEMENT NEEDED:** Restrict to specific origin(s) in production

**2. Signature Verification:**
- MD5 HMAC-based authentication
- Ensures PayFast notification authenticity
- Protects against man-in-the-middle attacks and tampered payment data
- Prevents unauthorized webhook manipulation

**3. HTTPS for External APIs:**
- Communication with PayFast uses HTTPS (port 443)
- Encrypts data in transit
- Prevents credential exposure

**4. Environment Variables:**
- Sensitive credentials stored in .env file (merchant keys, API secrets)
- Never committed to version control
- Keeps secrets out of source code

### CRITICAL Security Measures to Implement:

**1. Rate Limiting:**
- Implement rate limiting on /api/pay and /api/notify_url endpoints
- Protection against:
  - Brute force attacks
  - DDoS attempts
  - Abuse of payment initiation (spam requests)
  - Webhook replay attacks
- Recommended approach:
  - IP-based rate limiting: 10-20 requests per minute per IP for payment initiation
  - Use express-rate-limit middleware
  - Different thresholds for internal vs external IPs
  - Account-based limiting with API keys for trusted partners

**2. CORS Hardening:**
- Replace global CORS with whitelist-based configuration:
  ```
  - Allowed Origins: Only your frontend domain(s)
  - Allowed Methods: POST only (no GET, PUT, DELETE)
  - Allowed Headers: Content-Type only
  - Credentials: false (no cookie-based auth needed)
  - Max Age: 600 seconds
  ```
- Prevent CSRF attacks through origin verification

**3. Input Validation & Sanitization:**
- Validate all request payloads:
  - amount: Must be numeric, positive, reasonable range
  - name_first: Length limits, allowed characters
  - item_name: UTF-8 validation, length limits
  - item_description: XSS prevention, length limits
  - orderID: Alphanumeric validation, uniqueness check against database
- Prevent injection attacks and malformed data

**4. Request/Response Encryption:**
- All sensitive data in responses wrapped with encryption
- Consider implementing request signing for internal APIs
- JWT tokens for authenticated endpoints (future scaling)

**5. API Authentication:**
- Implement API key authentication on /api/pay endpoint
- Only authorized clients can initiate payments
- Track API usage per key
- Rotate keys regularly

**6. Webhook Security:**
- Webhook endpoint requires signature verification (currently implemented)
- Implement idempotency checking: Prevent duplicate processing with order ID deduplication
- Timeout protection: Set max request timeout (30 seconds)
- IP whitelisting: Whitelist PayFast sandbox/production IPs
- Retry mechanism with exponential backoff for outbound SMS

**7. Data Protection:**
- Encrypt sensitive fields in database (if added)
- GDPR/privacy compliance: Implement data retention policies
- Audit logging: Log all payment attempts, verifications, and notifications
- No sensitive data in logs (mask amounts, customer names)

**8. Error Handling:**
- Generic error messages to clients (don't expose internal details)
- Detailed error logging for debugging
- Never expose environment variables in error responses
- Handle network timeouts gracefully

**9. Dependency Security:**
- Regular npm audit checks
- Update dependencies quarterly minimum
- Review security advisories
- Lock dependencies with package-lock.json

**10. Infrastructure Security:**
- HTTPS only (enforce in production)
- Secure headers (Helmet.js middleware recommended)
- X-Frame-Options: DENY (prevent clickjacking)
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)

## Benefits & Trade-offs

### Benefits of Current Architecture:

1. **Simplicity:** Minimal dependencies, easy to understand and maintain
2. **TypeScript Safety:** Type checking prevents runtime errors
3. **Dual Verification:** Both signature and server validation ensure payment legitimacy
4. **Webhook Notifications:** SMS alerts for payment completion
5. **Sandbox Support:** Easy testing environment switch
6. **Decoupled from DB:** Stateless design allows horizontal scaling

### Trade-offs:

1. **Security Complexity:** Many security features need implementation (rate limiting, validation)
2. **Limited Scalability:** No load balancing strategy, single instance bottleneck
3. **No Database:** Payment history not persisted, relies on PayFast records
4. **SMS Dependency:** External API (MyMobileAPI) creates additional failure point
5. **Error Recovery:** No automatic retry logic for failed validations
6. **Monitoring:** No built-in logging/observability solution
7. **No Payment Status Queries:** Can't check payment status after initiation
8. **Test Coverage:** No unit/integration tests visible in codebase
9. **Documentation:** Code lacks JSDoc comments and inline documentation
10. **Versioning:** No API versioning strategy for future changes

## API Endpoints

### 1. POST /api/pay
**Purpose:** Initiate a payment request

**Request Body:**
```json
{
  "name_first": "John",
  "amount": "500.00",
  "item_name": "Letlhogonolo",
  "item_description": "Letlhogonolo school fees",
  "orderID": "order-123"
}
```

**Response:** Redirect URL string to PayFast checkout
**Status Codes:** 200 (Success), 400 (Invalid data), 429 (Rate limit), 503 (Service unavailable)

### 2. POST /api/notify_url
**Purpose:** Receive payment status notifications from PayFast

**Expected Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Response:** "ITN received" (200 OK)
**Status Codes:** 200 (Valid), 400 (Invalid signature), 500 (Processing error)

## Environment Configuration

**Required Environment Variables:**
```
PORT=3000
MERCHANT_ID=<PayFast merchant ID>
MERCHANT_KEY=<PayFast merchant key>
PAYFAST_PASSPHRASE=<Signature verification passphrase>
RETURN_URL=<Post-payment success URL>
CANCEL_URL=<Payment cancellation URL>
NOTIFY_URL=<Webhook endpoint URL>
CLIENT_ID=<MyMobileAPI client ID>
API_SECRET=<MyMobileAPI secret>
DESTINATION=<SMS destination number>
NODE_ENV=development|production
```

## Development & Deployment

### Local Development:
```bash
npm install
npm run dev  # Runs with ts-node-dev for auto-reload
```

### Production Build:
```bash
npm run build  # Compiles TypeScript to dist/
npm start      # Runs compiled JavaScript
```

### Key Configuration Files:
- **tsconfig.json:** TypeScript compiler settings (ES2020 target, NodeNext modules)
- **package.json:** Dependencies and npm scripts
- **tsconfig.json:** Compiled output to dist/ directory

## Recommendations for Enhancement

1. **Implement Database:** PostgreSQL/MongoDB for payment history tracking
2. **Add Request Logging:** Winston or Pino for structured logging
3. **Implement Monitoring:** Prometheus metrics and Grafana dashboards
4. **Error Handling:** Comprehensive error tracking (Sentry integration)
5. **Testing:** Jest/Mocha for unit and integration tests
6. **API Versioning:** Version endpoints (/v1/api/pay, /v2/api/pay)
7. **Documentation:** OpenAPI/Swagger specification
8. **Authentication:** OAuth2 or JWT for client authentication
9. **Payment Status API:** Endpoint to query payment history
10. **Reconciliation:** Automated reconciliation process with PayFast
11. **WebHook Retries:** Implement retry logic with exponential backoff
12. **Idempotency Keys:** Support idempotent requests to prevent duplicates

## Compliance & Standards

- **PCI DSS Partial Compliance:** Delegates main PCI burden to PayFast
- **Payment Security:** Follows PayFast security requirements
- **GDPR:** Need to implement data privacy controls
- **Error Handling:** Implement secure error handling without data leakage

---

**Note:** This documentation will be updated whenever new features are added, dependencies updated, or security measures implemented. Maintain version history of this documentation.
