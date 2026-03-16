"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { notification } from "~~/utils/helper/notification";

interface AttestationsViewProps {
  payroll: any;
  attestationAddress?: string;
  attestationAbi?: any[];
}

export function AttestationsView({
  payroll,
  attestationAddress,
  attestationAbi,
}: AttestationsViewProps) {
  const [attestationType, setAttestationType] = useState(0); // 0=above, 1=below, 2=inRange
  const [threshold, setThreshold] = useState("");
  const [upperBound, setUpperBound] = useState("");
  const [verifierAddress, setVerifierAddress] = useState("");
  const [message, setMessage] = useState("");

  const createAttestation = async () => {
    if (!attestationAddress || !attestationAbi || !payroll.ethersSigner) return;
    if (!payroll.accounts?.[0] || !payroll.mySalaryHandle || payroll.mySalaryHandle === ethers.ZeroHash) {
      notification.error("No salary handle found. Are you registered as an employee?");
      return;
    }
    setMessage("Creating attestation...");
    try {
      const contract = new ethers.Contract(attestationAddress, attestationAbi, payroll.ethersSigner);
      const employeeAddr = payroll.accounts[0];
      const salaryHandle = payroll.mySalaryHandle;
      const thresholdUnits = Math.round(parseFloat(threshold) * 1_000_000);
      let tx;
      if (attestationType === 0) {
        tx = await contract.attestSalaryAbove(employeeAddr, salaryHandle, thresholdUnits, verifierAddress);
      } else if (attestationType === 1) {
        tx = await contract.attestSalaryBelow(employeeAddr, salaryHandle, thresholdUnits, verifierAddress);
      } else {
        const upperUnits = Math.round(parseFloat(upperBound) * 1_000_000);
        tx = await contract.attestSalaryInRange(employeeAddr, salaryHandle, thresholdUnits, upperUnits, verifierAddress);
      }
      await tx.wait();
      notification.success("Attestation created successfully!");
      setMessage("");
      setThreshold("");
      setUpperBound("");
      setVerifierAddress("");
    } catch (e) {
      notification.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      setMessage("");
    }
  };

  const typeLabels = ["Salary Above Threshold", "Salary Below Threshold", "Salary In Range"];
  const typeDescriptions = [
    "Prove your salary is above a certain amount without revealing the exact figure",
    "Prove your salary is below a certain amount",
    "Prove your salary falls within a specific range",
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Salary Attestations</h2>

      {/* Explainer */}
      <div className="bg-indigo-50 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Zero-Knowledge Income Proof</h3>
            <p className="text-xs text-gray-500">
              Generate on-chain proofs about your salary for banks, landlords, or visa applications — without revealing the exact amount.
            </p>
          </div>
        </div>
      </div>

      {/* Create Attestation */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Create New Attestation</h3>

        {message && (
          <div className={`rounded-lg px-4 py-2 text-sm mb-4 ${message.includes("Failed") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
            {message}
          </div>
        )}

        {/* Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {typeLabels.map((label, i) => (
            <button
              key={i}
              onClick={() => setAttestationType(i)}
              className={`p-4 rounded-lg border text-left transition-all ${
                attestationType === i
                  ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-[10px] text-gray-400 mt-1">{typeDescriptions[i]}</p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="number"
              placeholder={attestationType === 2 ? "Lower bound (cUSDT)" : "Threshold (cUSDT)"}
              className="border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
            />
            {attestationType === 2 && (
              <input
                type="number"
                placeholder="Upper bound (cUSDT)"
                className="border border-gray-300 rounded-lg p-3 text-sm text-gray-900 bg-white"
                value={upperBound}
                onChange={e => setUpperBound(e.target.value)}
              />
            )}
          </div>
          <input
            type="text"
            placeholder="Verifier address (0x...)"
            className="w-full border border-gray-300 rounded-lg p-3 text-sm font-mono text-gray-900 bg-white"
            value={verifierAddress}
            onChange={e => setVerifierAddress(e.target.value)}
          />
          <button
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            disabled={!threshold || !verifierAddress || (attestationType === 2 && !upperBound)}
            onClick={createAttestation}
          >
            Create Attestation
          </button>
        </div>
      </div>

      {/* Use Cases */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Common Use Cases</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UseCaseCard
            icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            title="Rental Application"
            desc="Prove income > 3x rent without revealing salary"
          />
          <UseCaseCard
            icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            title="Bank Loan"
            desc="Verify income range for loan qualification"
          />
          <UseCaseCard
            icon="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
            title="Visa Application"
            desc="Prove minimum income for immigration requirements"
          />
        </div>
      </div>
    </div>
  );
}

function UseCaseCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center mb-3">
        <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} /></svg>
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-[10px] text-gray-400 mt-1">{desc}</p>
    </div>
  );
}
