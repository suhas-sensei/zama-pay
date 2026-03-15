"use client";

import { useMemo, useState } from "react";
import { useFhevm } from "@fhevm-sdk";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { useConfidentialPayroll } from "~~/hooks/payroll/useConfidentialPayroll";
import { EmployerDashboard } from "./_components/EmployerDashboard";
import { EmployeePortal } from "./_components/EmployeePortal";

export default function Home() {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const [activeTab, setActiveTab] = useState<"employer" | "employee">("employer");

  const provider = useMemo(() => {
    if (typeof window === "undefined" || !isConnected) return undefined;
    // For local Hardhat, pass RPC URL directly to avoid MetaMask routing issues
    if (chainId === 31337) return "http://localhost:8545";
    return (window as any).ethereum;
  }, [isConnected, chainId]);

  const initialMockChains = useMemo(() => ({ 31337: "http://localhost:8545" }), []);

  const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: isConnected,
  });

  const payroll = useConfidentialPayroll({
    instance: fhevmInstance,
    initialMockChains,
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="bg-gray-50 border border-gray-300 shadow-xl p-10 text-center max-w-md">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">Confidential Payroll</h1>
          <p className="text-gray-600 mb-6">
            Private onchain payroll powered by Fully Homomorphic Encryption.
            Salaries are encrypted — only you and your employer can see them.
          </p>
          <div className="flex justify-center">
            <RainbowKitCustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4 bg-white text-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Confidential Payroll</h1>
        <p className="text-gray-500 text-sm">
          Encrypted onchain payroll using Zama FHE &middot;{" "}
          <span className="font-mono text-xs">{payroll.payrollAddress?.slice(0, 10)}...</span>
        </p>
      </div>

      {/* FHE Status */}
      {fhevmStatus !== "ready" && (
        <div className={`px-4 py-3 text-sm border ${fhevmStatus === "error" ? "bg-red-50 border-red-300 text-red-700" : "bg-yellow-50 border-yellow-300 text-yellow-700"}`}>
          FHE Status: {fhevmStatus} {fhevmError && `— ${fhevmError.message}`}
        </div>
      )}

      {/* Status bar */}
      {payroll.message && (
        <div className="bg-gray-100 border border-gray-300 px-4 py-3 text-sm text-gray-700">
          {payroll.message}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-300">
        <button
          className={`px-6 py-3 font-medium text-sm ${
            activeTab === "employer"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("employer")}
        >
          Employer Dashboard
          {payroll.isEmployer && (
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5">You</span>
          )}
        </button>
        <button
          className={`px-6 py-3 font-medium text-sm ${
            activeTab === "employee"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("employee")}
        >
          Employee Portal
          {payroll.isEmployeeUser && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5">You</span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "employer" ? (
        payroll.isEmployer ? (
          <EmployerDashboard payroll={payroll} />
        ) : (
          <div className="bg-gray-50 border border-gray-300 p-8 text-center">
            <p className="text-gray-700">
              Only the employer can access this dashboard.
            </p>
            <p className="text-gray-500 text-sm mt-2 font-mono">
              Employer: {payroll.employer}
            </p>
          </div>
        )
      ) : (
        <EmployeePortal payroll={payroll} />
      )}

      {/* Contract Info Footer */}
      <div className="border-t border-gray-300 pt-4 mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="font-medium text-gray-600">Payroll Contract</p>
            <p className="font-mono break-all text-gray-500">{payroll.payrollAddress}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">Token Contract</p>
            <p className="font-mono break-all text-gray-500">{payroll.tokenAddress}</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">Token</p>
            <p className="text-gray-500">{payroll.tokenSymbol ?? "..."} ({payroll.tokenName ?? "..."})</p>
          </div>
          <div>
            <p className="font-medium text-gray-600">Total Supply</p>
            <p className="text-gray-500">{payroll.totalSupply > 0 ? (payroll.totalSupply / 1_000_000).toFixed(2) : "0"} cUSDT</p>
          </div>
        </div>
      </div>
    </div>
  );
}
