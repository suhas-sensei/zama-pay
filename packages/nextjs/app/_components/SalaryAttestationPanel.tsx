"use client";
import { useState } from "react";
import { ethers } from "ethers";

interface SalaryAttestationPanelProps {
  payroll: any;
  attestationAddress?: string;
  attestationAbi?: any[];
  payrollAddress?: string;
  payrollAbi?: any[];
}

export const SalaryAttestationPanel = ({ payroll, attestationAddress, attestationAbi, payrollAddress, payrollAbi }: SalaryAttestationPanelProps) => {
  const [attestType, setAttestType] = useState<"above" | "below" | "range">("above");
  const [threshold, setThreshold] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [maxThreshold, setMaxThreshold] = useState("");
  const [verifierAddress, setVerifierAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [attestations, setAttestations] = useState<any[]>([]);

  const createAttestation = async () => {
    if (!attestationAddress || !attestationAbi || !payrollAddress || !payrollAbi) return;
    setIsLoading(true);
    setMessage("Creating attestation...");
    try {
      if (!payroll.ethersSigner || !payroll.ethersReadonlyProvider) return;
      const userAddress = payroll.accounts[0];

      // Get salary handle from payroll contract
      const payrollContractRead = new ethers.Contract(payrollAddress, payrollAbi, payroll.ethersReadonlyProvider);
      const salaryHandle = await payrollContractRead.getEmployeeSalary(userAddress);

      const attestContract = new ethers.Contract(attestationAddress, attestationAbi, payroll.ethersSigner);

      let tx;
      if (attestType === "above") {
        const thresholdUnits = Math.round(parseFloat(threshold) * 1_000_000);
        tx = await attestContract.attestSalaryAbove(userAddress, salaryHandle, thresholdUnits, verifierAddress);
      } else if (attestType === "below") {
        const thresholdUnits = Math.round(parseFloat(threshold) * 1_000_000);
        tx = await attestContract.attestSalaryBelow(userAddress, salaryHandle, thresholdUnits, verifierAddress);
      } else {
        const minUnits = Math.round(parseFloat(minThreshold) * 1_000_000);
        const maxUnits = Math.round(parseFloat(maxThreshold) * 1_000_000);
        tx = await attestContract.attestSalaryInRange(userAddress, salaryHandle, minUnits, maxUnits, verifierAddress);
      }
      await tx.wait();
      setMessage("Attestation created! The verifier can now check the encrypted result on-chain.");
      setThreshold("");
      setMinThreshold("");
      setMaxThreshold("");
      setVerifierAddress("");
      fetchAttestations();
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAttestations = async () => {
    if (!attestationAddress || !attestationAbi || !payroll.accounts?.[0]) return;
    try {
      if (!payroll.ethersReadonlyProvider) return;
      const contract = new ethers.Contract(attestationAddress, attestationAbi, payroll.ethersReadonlyProvider);
      const ids = await contract.getEmployeeAttestations(payroll.accounts[0]);
      const results = [];
      for (const id of ids) {
        const info = await contract.getAttestationInfo(id);
        results.push({
          id: Number(id),
          verifier: info[1],
          type: ["Above", "Below", "In Range", "Employment"][Number(info[2])],
          threshold: Number(info[3]) / 1_000_000,
          minThreshold: Number(info[4]) / 1_000_000,
          maxThreshold: Number(info[5]) / 1_000_000,
          timestamp: new Date(Number(info[6]) * 1000).toLocaleString(),
        });
      }
      setAttestations(results);
    } catch {}
  };

  return (
    <div className="bg-white border border-gray-200 p-6">
      <h3 className="text-lg font-bold mb-2 text-gray-900">Salary Attestation</h3>
      <p className="text-gray-500 text-sm mb-4">
        Prove your salary meets a threshold without revealing the exact amount.
        Useful for loan applications, rental agreements, or visa proofs.
      </p>

      {message && (
        <div className="bg-gray-100 border border-gray-300 px-3 py-2 text-sm text-gray-700 mb-4">{message}</div>
      )}

      <div className="space-y-3 mb-6">
        <select
          className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
          value={attestType}
          onChange={e => setAttestType(e.target.value as any)}
        >
          <option value="above">Salary is above threshold</option>
          <option value="below">Salary is below threshold</option>
          <option value="range">Salary is within range</option>
        </select>

        {attestType !== "range" ? (
          <input
            type="number"
            placeholder="Threshold (cUSDT, e.g. 3000)"
            className="w-full border border-gray-300 p-3 text-sm text-gray-900 bg-white"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Min (e.g. 2000)"
              className="border border-gray-300 p-3 text-sm text-gray-900 bg-white"
              value={minThreshold}
              onChange={e => setMinThreshold(e.target.value)}
            />
            <input
              type="number"
              placeholder="Max (e.g. 8000)"
              className="border border-gray-300 p-3 text-sm text-gray-900 bg-white"
              value={maxThreshold}
              onChange={e => setMaxThreshold(e.target.value)}
            />
          </div>
        )}

        <input
          type="text"
          placeholder="Verifier address (bank, landlord — 0x...)"
          className="w-full border border-gray-300 p-3 text-sm font-mono text-gray-900 bg-white"
          value={verifierAddress}
          onChange={e => setVerifierAddress(e.target.value)}
        />

        <button
          className="w-full bg-purple-600 text-white py-3 font-semibold hover:bg-purple-700 disabled:opacity-50"
          disabled={isLoading || !verifierAddress || (attestType !== "range" ? !threshold : !minThreshold || !maxThreshold)}
          onClick={createAttestation}
        >
          {isLoading ? "Creating..." : "Create Attestation"}
        </button>
      </div>

      <h4 className="font-semibold text-gray-800 mb-2">Your Attestations</h4>
      <button className="text-blue-600 text-sm underline mb-3" onClick={fetchAttestations}>Refresh</button>
      {attestations.length === 0 ? (
        <p className="text-gray-500 text-sm">No attestations yet.</p>
      ) : (
        <div className="space-y-2">
          {attestations.map((a, i) => (
            <div key={i} className="py-3 px-4 bg-gray-50 border border-gray-200 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">#{a.id} — {a.type}</span>
                <span className="text-gray-500">{a.timestamp}</span>
              </div>
              <div className="text-gray-600 mt-1">
                {a.type === "In Range"
                  ? `Range: ${a.minThreshold} – ${a.maxThreshold} cUSDT`
                  : `Threshold: ${a.threshold} cUSDT`}
              </div>
              <div className="text-gray-500 font-mono text-xs mt-1">
                Verifier: {a.verifier.slice(0, 10)}...{a.verifier.slice(-6)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
