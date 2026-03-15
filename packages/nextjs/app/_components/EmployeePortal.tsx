"use client";

import { ethers } from "ethers";

interface EmployeePortalProps {
  payroll: any;
}

export const EmployeePortal = ({ payroll }: EmployeePortalProps) => {
  const decryptedSalary = payroll.mySalaryHandle && payroll.mySalaryHandle !== ethers.ZeroHash
    ? payroll.salaryDecrypt.results[payroll.mySalaryHandle]
    : payroll.mySalaryHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const decryptedBalance = payroll.myBalanceHandle && payroll.myBalanceHandle !== ethers.ZeroHash
    ? payroll.balanceDecrypt.results[payroll.myBalanceHandle]
    : payroll.myBalanceHandle === ethers.ZeroHash ? BigInt(0) : undefined;

  const formatAmount = (val: bigint | undefined) => {
    if (val === undefined) return "Encrypted";
    return `${(Number(val) / 1_000_000).toFixed(2)} cUSDT`;
  };

  if (!payroll.isEmployeeUser) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="bg-white border border-gray-200 p-8">
          <div className="text-4xl mb-4">?</div>
          <h2 className="text-xl font-bold mb-2">Not Registered</h2>
          <p className="text-gray-600">
            Your wallet address is not registered as an employee in this payroll system.
            Contact your employer to be added.
          </p>
          <p className="text-gray-400 text-sm mt-4 font-mono">
            {payroll.accounts?.[0] ?? "Not connected"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-white border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-1">My Payroll Dashboard</h2>
        <p className="text-gray-500 text-sm font-mono">{payroll.accounts?.[0]}</p>
      </div>

      {/* Key Figures */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Salary */}
        <div className="bg-white border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-1">My Monthly Salary</p>
          <p className="text-2xl font-bold text-gray-900">
            {decryptedSalary !== undefined ? formatAmount(decryptedSalary) : "***"}
          </p>
          {payroll.salaryDecrypt.canDecrypt && (
            <button
              className="mt-2 text-sm bg-black text-white px-4 py-2 hover:bg-gray-800"
              onClick={payroll.salaryDecrypt.decrypt}
              disabled={payroll.salaryDecrypt.isDecrypting}
            >
              {payroll.salaryDecrypt.isDecrypting ? "Decrypting..." : "Decrypt Salary"}
            </button>
          )}
          {payroll.salaryDecrypt.isDecrypting && (
            <p className="text-sm text-gray-500 mt-2">Decrypting...</p>
          )}
        </div>

        {/* Balance */}
        <div className="bg-white border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-1">My cUSDT Balance</p>
          <p className="text-2xl font-bold text-gray-900">
            {decryptedBalance !== undefined ? formatAmount(decryptedBalance) : "***"}
          </p>
          {payroll.balanceDecrypt.canDecrypt && (
            <button
              className="mt-2 text-sm bg-black text-white px-4 py-2 hover:bg-gray-800"
              onClick={payroll.balanceDecrypt.decrypt}
              disabled={payroll.balanceDecrypt.isDecrypting}
            >
              {payroll.balanceDecrypt.isDecrypting ? "Decrypting..." : "Decrypt Balance"}
            </button>
          )}
        </div>

        {/* Payments Received */}
        <div className="bg-white border border-gray-200 p-6">
          <p className="text-gray-500 text-sm mb-1">Payments Received</p>
          <p className="text-2xl font-bold text-gray-900">{payroll.paymentHistoryCount}</p>
        </div>
      </div>

      {/* Encrypted Handles (debug/proof) */}
      <div className="bg-white border border-gray-200 p-6">
        <h3 className="text-lg font-bold mb-4">On-Chain Proof</h3>
        <p className="text-gray-600 text-sm mb-4">
          These are your encrypted data handles on-chain. Only you and the employer can decrypt them.
        </p>
        <div className="space-y-3">
          <div className="bg-gray-50 p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Salary Handle</p>
            <p className="font-mono text-xs break-all text-gray-700">
              {payroll.mySalaryHandle ?? "N/A"}
            </p>
          </div>
          <div className="bg-gray-50 p-3 border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Balance Handle</p>
            <p className="font-mono text-xs break-all text-gray-700">
              {payroll.myBalanceHandle ?? "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 p-4">
        <p className="text-blue-800 text-sm">
          Your salary and balance are fully encrypted on-chain using Fully Homomorphic Encryption (FHE).
          No one — not even validators — can see your salary amount. Only you and the employer have decryption access.
        </p>
      </div>
    </div>
  );
};
