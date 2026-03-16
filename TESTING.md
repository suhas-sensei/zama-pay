# Testing Guide — ConfidentialPay (ZamaPay)

## Prerequisites

```bash
# Terminal 1: Start local Hardhat node
pnpm chain

# Terminal 2: Deploy all contracts
pnpm deploy:localhost

# Terminal 3: Start frontend
pnpm start
```

Open `http://localhost:3000` in your browser.

## MetaMask Setup

- **Network:** `http://127.0.0.1:8545`, Chain ID `31337`, Currency `ETH`
- Import these accounts:

| Role | Address | Private Key |
|------|---------|-------------|
| Employer (Account #0) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| Employee 1 (Account #1) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| Employee 2 (Account #2) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| HR Admin (Account #3) | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| Finance (Account #4) | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

---

## Phase 1: Core Setup (as Employer — Account #0)

1. Connect MetaMask with Account #0
2. **Mint cUSDT** — Recipient: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`, Amount: `100000`
3. **Approve Payroll Contract** — Click the yellow "Approve Payroll Contract" button
4. **Add Employee** — Address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`, Salary: `5000`
5. **Add Employee** — Address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`, Salary: `3000`
6. **Execute Payroll** — Click the green "Execute Payroll" button

**Expected:** Both employees appear in Active Employees list. Payrolls Run shows 1. Total Supply shows 100000.00 cUSDT.

---

## Phase 2: Test Role Management (as Employer)

7. Scroll to **Role Management** section
8. Grant **HR Admin** to `0x90F79bf6EB2c4f870365E785982E1f101E93b906` (Account #3)
9. Grant **Finance** to `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` (Account #4)

**Expected:** Both addresses appear in "Current Role Holders" with their respective roles.

---

## Phase 3: Test Payroll Scheduler (as Employer)

10. Scroll to **Payroll Scheduler** section
11. Select **Monthly**, pick a date/time **in the past** (so it's immediately executable)
12. Click **Create Schedule**
13. Click **Trigger Payroll Now**

**Expected:** Schedule shows as Active with Monthly frequency. After triggering, Total Runs increments and Next Pay Date updates to ~30 days from now.

---

## Phase 4: Test Employee Portal (switch to Account #1)

14. Switch MetaMask to Account #1 (`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`)
15. Click **Employee Portal** tab
16. Click **Decrypt Salary** — should show **5000.00 cUSDT**
17. Click **Decrypt Balance** — should show **10000.00 cUSDT** (2 payroll runs × 5000)

**Expected:** Employee dashboard shows salary, balance, payment count, and on-chain proof handles.

---

## Phase 5: Test Salary Attestation (as Employee — Account #1)

18. Scroll to **Salary Attestation** section
19. Select **"Salary is above threshold"**
20. Threshold: `3000`
21. Verifier address: `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65`
22. Click **Create Attestation**

**Expected:** Attestation appears in "Your Attestations" list with type "Above", threshold 3000 cUSDT, and the verifier address.

---

## Phase 6: Test Reimbursement (as Employee — Account #1)

23. Scroll to **Reimbursements** section
24. Description: `Office supplies`, Amount: `150`
25. Click **Submit Request**
26. Switch back to **Account #0** (Employer)
27. Go to **Employer Dashboard** → scroll to reimbursement section
28. **Approve** the pending reimbursement

**Expected:** Employee sees "Pending" status. After employer approval, status changes to "Approved".

---

## Phase 7: Test Analytics Dashboard (as Employer — Account #0)

29. Scroll to **Payroll Analytics** section
30. Create a department: `Engineering`
31. Create another department: `Marketing`

**Expected:** Departments appear with headcount and encrypted budget indicators.

---

## Summary of Features Tested

| # | Feature | What it proves |
|---|---------|---------------|
| 1 | Core Payroll | Encrypted salary storage, confidential transfers, employee verification |
| 2 | Role-Based Access Control | HR/Finance/Auditor delegation without salary visibility |
| 3 | Payroll Scheduler | Recurring automated payroll with time-lock enforcement |
| 4 | Salary Attestation | Zero-knowledge salary proofs for third parties (banks, landlords) |
| 5 | Employee Self-Service | Reimbursement requests, payment history, encrypted payslips |
| 6 | Analytics Dashboard | Department-level encrypted aggregates, payroll snapshots |