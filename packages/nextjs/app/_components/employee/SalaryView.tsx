"use client";

import { ethers } from "ethers";

interface SalaryViewProps {
  payroll: any;
}

export function SalaryView({ payroll }: SalaryViewProps) {
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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">My Salary</h2>

      {/* Salary Card */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white">
        <p className="text-sm opacity-80 mb-1">Monthly Salary</p>
        <p className="text-4xl font-bold mb-4">
          {decryptedSalary !== undefined ? formatAmount(decryptedSalary) : "*** *** ***"}
        </p>
        {payroll.salaryDecrypt.canDecrypt && decryptedSalary === undefined && (
          <button
            className="bg-white/20 backdrop-blur-sm text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
            onClick={payroll.salaryDecrypt.decrypt}
            disabled={payroll.salaryDecrypt.isDecrypting}
          >
            {payroll.salaryDecrypt.isDecrypting ? "Decrypting..." : "Decrypt Salary"}
          </button>
        )}
        {decryptedSalary !== undefined && (
          <p className="text-sm opacity-70 mt-2">Decrypted successfully. Only you and your employer can see this.</p>
        )}
      </div>

      {/* Balance Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">cUSDT Balance</p>
            <p className="text-3xl font-bold text-gray-900">
              {decryptedBalance !== undefined ? formatAmount(decryptedBalance) : "Encrypted"}
            </p>
          </div>
          {payroll.balanceDecrypt.canDecrypt && decryptedBalance === undefined && (
            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
              onClick={payroll.balanceDecrypt.decrypt}
              disabled={payroll.balanceDecrypt.isDecrypting}
            >
              {payroll.balanceDecrypt.isDecrypting ? "Decrypting..." : "Decrypt"}
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">How FHE Works</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Your salary is encrypted using Fully Homomorphic Encryption before being stored on-chain.
            The blockchain can process encrypted computations without ever seeing the actual value.
            Only you and your employer hold the decryption keys.
          </p>
        </div>
        <div className="bg-green-50 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Privacy Guaranteed</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            No one on the blockchain — not validators, not other employees, not the public — can see your salary.
            Payroll transfers happen with encrypted amounts. Your financial privacy is mathematically guaranteed.
          </p>
        </div>
      </div>

      {/* Encrypted Handles */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Encrypted Data Handles</h3>
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Salary Ciphertext Handle</p>
              <span className="text-[10px] text-indigo-600 font-medium">euint64</span>
            </div>
            <p className="font-mono text-xs break-all text-gray-600">{payroll.mySalaryHandle ?? "Not available"}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Balance Ciphertext Handle</p>
              <span className="text-[10px] text-indigo-600 font-medium">euint64</span>
            </div>
            <p className="font-mono text-xs break-all text-gray-600">{payroll.myBalanceHandle ?? "Not available"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
