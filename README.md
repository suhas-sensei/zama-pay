# ZamaPay - Confidential Onchain Payroll

A payroll system on Ethereum where salaries are encrypted end-to-end. Only you and your employer can see what you earn.

Built with [Zama's fhEVM](https://docs.zama.org/fhevm) and [ERC-7984](https://eips.ethereum.org/EIPS/eip-7984) confidential tokens using Fully Homomorphic Encryption (FHE).

## Live Demo

- **Frontend:** https://zama-pay-frontend.vercel.app
- **Contracts (Sepolia):** [View on Etherscan](https://sepolia.etherscan.io/address/0xb974F8309eCAC143287f566A8a1a7cD0f37a67Af)

## Architecture

| Contract | Address (Sepolia) | Purpose |
|---|---|---|
| ConfidentialPayrollToken | `0xC293AE78C5a2DE85B3aaE5919cc328FdA899e1e9` | FHE-encrypted ERC20 (cUSDT) |
| ConfidentialPayroll | `0xb974F8309eCAC143287f566A8a1a7cD0f37a67Af` | Core payroll logic |
| PayrollAccessControl | `0x36a9a89d2f565673A642a0f63AC3A6D2358663b7` | Role-based access (HR, CFO, Auditor) |
| SalaryAttestation | `0xFF93aA11f96Db1df97eAC1184040dfa0A4D7479d` | ZK-style income proofs via FHE |
| PayrollScheduler | `0x5a22d83e454f30ec63e47F153bc55abd1BBa5683` | Recurring payroll automation |
| PayrollAnalytics | `0x35B9a1282e7Ea6eB1320EdFcfc286561f9817F6D` | Encrypted department-level analytics |
| ConfidentialPayrollFactory | (not deployed - exceeds size limit) | Multi-company deployment factory |

## Features

1. **Encrypted Salaries** - Salaries are FHE-encrypted on-chain. Only employer + employee can decrypt.
2. **Confidential Payroll Execution** - Transfer encrypted amounts to all employees in one transaction.
3. **Role-Based Access Control** - HR Admin, Finance/CFO, Auditor roles with different permissions.
4. **Salary Attestations** - Employees can prove "salary > X" without revealing the exact amount (for banks, landlords, visa).
5. **Recurring Payroll Scheduler** - Automated payroll with weekly/biweekly/monthly schedules.
6. **Employee Self-Service** - Reimbursement requests, payment history, encrypted payslips.
7. **Confidential Analytics** - Department-level salary distribution (encrypted until decrypted).

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity + fhEVM (FHE.sol) |
| Token Standard | ERC-7984 (Confidential ERC20) |
| Framework | Hardhat + fhEVM plugin |
| Frontend | Next.js 15 + wagmi + RainbowKit |
| FHE SDK | fhevmjs (Zama Relayer SDK) |
| Charts | Recharts |
| Deployment | Sepolia testnet |

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask

### Setup

```bash
git clone https://github.com/suhas-sensei/zama-pay.git
cd zama-pay
pnpm install
```

### Run Locally

```bash
# Terminal 1: Start local Hardhat node with fhEVM
pnpm chain

# Terminal 2: Deploy contracts
pnpm deploy:localhost

# Terminal 3: Start frontend
pnpm start
```

Open http://localhost:3000

### Test Accounts (Local Hardhat Only)

Import these into MetaMask (Network: localhost:8545, Chain ID: 31337):

**Employer (Account #0):**
```
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**Employee (Account #1):**
```
Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

These are standard Hardhat test accounts - never use them on mainnet.

## Testing Flow

### As Employer
1. Connect with employer account, select "Employer"
2. Go to **Payroll** tab -> Mint cUSDT (e.g. 100,000 to your address)
3. Approve payroll contract when prompted
4. Go to **Employees** tab -> Add employees with encrypted salaries
5. Go to **Payroll** tab -> Execute Payroll
6. Go to **Reports** tab -> Decrypt to view salary distribution

### As Employee
1. Connect with employee account, select "Employee"
2. **Overview** -> Decrypt salary and balance
3. **Attestations** -> Create proof that salary > threshold
4. **Reimbursements** -> Submit expense request

## Deploy to Sepolia

```bash
cd packages/hardhat

# Set credentials
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY

# Deploy
npx hardhat deploy --network sepolia

# Generate frontend contract config
cd ../..
pnpm generate
```

## Project Structure

```
packages/
  hardhat/
    contracts/
      ConfidentialPayroll.sol        # Core payroll with FHE
      ConfidentialPayrollToken.sol   # Encrypted ERC20
      PayrollAccessControl.sol       # RBAC
      SalaryAttestation.sol          # Income proofs
      PayrollScheduler.sol           # Automated scheduling
      PayrollAnalytics.sol           # Encrypted analytics
      ConfidentialPayrollFactory.sol # Multi-company factory
    deploy/
      deploy.ts                     # Deployment script
  nextjs/
    app/
      _components/
        employer/                   # Employer dashboard views
        employee/                   # Employee portal views
        Sidebar.tsx                 # Navigation sidebar
      page.tsx                      # Main app with role selection
    hooks/
      payroll/
        useConfidentialPayroll.ts   # All contract interactions
    contracts/
      deployedContracts.ts          # Auto-generated ABIs + addresses
```

## How FHE Works in ZamaPay

1. **Encryption**: When an employer sets a salary, the value is encrypted client-side using the FHE public key before being sent on-chain.
2. **On-chain Storage**: The blockchain stores encrypted ciphertext handles (bytes32). Nobody can read the actual values.
3. **Computation**: The fhEVM precompile allows smart contracts to perform operations on encrypted data (comparisons, additions) without decrypting.
4. **Decryption**: Only authorized parties (employer + specific employee) can request decryption through the ACL system.
5. **Attestation**: FHE enables computing `salary >= threshold` on encrypted data, producing an encrypted boolean result that can be selectively shared.

## License

MIT
