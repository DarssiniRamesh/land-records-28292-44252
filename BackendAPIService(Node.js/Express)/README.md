# Land Records Backend API Service

This is the Node.js/Express backend for the **Land Records Management System**.  
It provides API endpoints for user authentication, RBAC, workflows, document management, payment logic, notifications, and sample/demo data.

## Features
- API gateway, user authentication & RBAC (jwt, roles: citizen, officer, admin)
- Complex application workflows for land record mutation, correction, conversion
- Land plot search/details (GIS data in-memory sample)
- Document upload (in-memory for demo)
- Payment demo logic (no real payment integration)
- Real-time notification triggers (in-memory example)
- Language preference (English/Hindi)
- In-memory demo/sample data (no persistent DB)

## Usage

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

3. API runs on port 3001 by default (change via PORT environment variable).

4. Use API endpoints documented in `/index.js`. No database connection – all data resets on restart.

## Demo Login Accounts

- Citizen:
    - email: `citizen@example.com`  password: `citizenpass`
- Officer:
    - email: `officer@gov.in`  password: `officerpass`
- Admin:
    - email: `admin@gov.in`  password: `adminpass`

## To Reset Sample Data

POST `/api/sample/reset` as admin user.

## Limitations

- All data is non-persistent (memory only)
- Payments are demo logic; no real payment gateway
- Document uploads not stored persistently

---
Land Records BackendAPIService(Node.js/Express)
