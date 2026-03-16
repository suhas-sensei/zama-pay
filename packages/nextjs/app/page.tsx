"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFhevm, useFHEDecrypt, useInMemoryStorage } from "@fhevm-sdk";
import { useAccount, useReadContracts } from "wagmi";
import { ethers } from "ethers";
import { useWagmiEthers } from "~~/hooks/wagmi/useWagmiEthers";
import { RainbowKitCustomConnectButton } from "~~/components/helper/RainbowKitCustomConnectButton";
import { notification } from "~~/utils/helper/notification";
import { useConfidentialPayroll } from "~~/hooks/payroll/useConfidentialPayroll";
import deployedContracts from "~~/contracts/deployedContracts";
import { Sidebar, type EmployerView, type EmployeeView } from "./_components/Sidebar";
import { OverviewView } from "./_components/employer/OverviewView";
import { EmployeesView } from "./_components/employer/EmployeesView";
import { PayrollView } from "./_components/employer/PayrollView";
import { ReportsView } from "./_components/employer/ReportsView";
import { SettingsView } from "./_components/employer/SettingsView";
import { EmployeeOverviewView } from "./_components/employee/OverviewView";
import { SalaryView } from "./_components/employee/SalaryView";
import { AttestationsView } from "./_components/employee/AttestationsView";
import { ReimbursementsView } from "./_components/employee/ReimbursementsView";
import { EmployeeSettingsView } from "./_components/employee/SettingsView";

function getContractInfo(chainId: number | undefined) {
  if (!chainId) return {};
  const chainContracts = (deployedContracts as any)[chainId];
  if (!chainContracts) return {};
  const result: Record<string, { address?: string; abi?: any[] }> = {};
  if (chainContracts.PayrollAccessControl) {
    result.accessControl = { address: chainContracts.PayrollAccessControl.address, abi: chainContracts.PayrollAccessControl.abi };
  }
  if (chainContracts.SalaryAttestation) {
    result.attestation = { address: chainContracts.SalaryAttestation.address, abi: chainContracts.SalaryAttestation.abi };
  }
  if (chainContracts.PayrollScheduler) {
    result.scheduler = { address: chainContracts.PayrollScheduler.address, abi: chainContracts.PayrollScheduler.abi };
  }
  if (chainContracts.PayrollAnalytics) {
    result.analytics = { address: chainContracts.PayrollAnalytics.address, abi: chainContracts.PayrollAnalytics.abi };
  }
  return result;
}

export default function Home() {
  const { isConnected, chain } = useAccount();
  const chainId = chain?.id;
  const [role, setRole] = useState<"employer" | "employee" | null>(null);
  const [employerView, setEmployerView] = useState<EmployerView>("overview");
  const [employeeView, setEmployeeView] = useState<EmployeeView>("overview");

  const provider = useMemo(() => {
    if (typeof window === "undefined" || !isConnected) return undefined;
    if (chainId === 31337) return "http://localhost:8545";
    return (window as any).ethereum;
  }, [isConnected, chainId]);

  const initialMockChains = useMemo(() => ({ 31337: "http://localhost:8545" }), []);

  const { instance: fhevmInstance, status: fhevmStatus } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: isConnected,
  });

  const payroll = useConfidentialPayroll({ instance: fhevmInstance, initialMockChains });
  const contractInfo = useMemo(() => getContractInfo(chainId), [chainId]);
  const payrollContractInfo = useMemo(() => {
    if (!chainId) return {};
    const chainContracts = (deployedContracts as any)[chainId];
    if (!chainContracts?.ConfidentialPayroll) return {};
    return { address: chainContracts.ConfidentialPayroll.address, abi: chainContracts.ConfidentialPayroll.abi };
  }, [chainId]);

  // ─── Shared salary decrypt for all employer views ───────────────────
  const { storage: fhevmDecryptStorage } = useInMemoryStorage();
  const wagmiEthers = useWagmiEthers(initialMockChains);

  const employeeSalaryContracts = useMemo(() => {
    if (!payrollContractInfo.address || !payrollContractInfo.abi || !payroll.employeeAddresses.length) return [];
    return payroll.employeeAddresses.map((addr: string) => ({
      address: payrollContractInfo.address as `0x${string}`,
      abi: payrollContractInfo.abi as any,
      functionName: "getEmployeeSalary",
      args: [addr],
    }));
  }, [payrollContractInfo, payroll.employeeAddresses]);

  const employeeSalaryHandles = useReadContracts({
    contracts: employeeSalaryContracts,
    query: { enabled: employeeSalaryContracts.length > 0 },
  });

  const salaryDecryptRequests = useMemo(() => {
    if (!employeeSalaryHandles.data || !payrollContractInfo.address) return undefined;
    const reqs: { handle: string; contractAddress: `0x${string}` }[] = [];
    for (const r of employeeSalaryHandles.data) {
      const handle = r.result as string | undefined;
      if (handle && handle !== ethers.ZeroHash) {
        reqs.push({ handle, contractAddress: payrollContractInfo.address as `0x${string}` });
      }
    }
    return reqs.length > 0 ? reqs : undefined;
  }, [employeeSalaryHandles.data, payrollContractInfo]);

  const employeeSalaryDecrypt = useFHEDecrypt({
    instance: fhevmInstance,
    ethersSigner: wagmiEthers.ethersSigner as any,
    fhevmDecryptionSignatureStorage: fhevmDecryptStorage,
    chainId: wagmiEthers.chainId,
    requests: salaryDecryptRequests,
  });

  // Build address → decrypted salary map
  const decryptedSalaryMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!employeeSalaryHandles.data) return map;
    payroll.employeeAddresses.forEach((addr: string, i: number) => {
      const handle = employeeSalaryHandles.data![i]?.result as string | undefined;
      if (handle && employeeSalaryDecrypt.results[handle] !== undefined) {
        map[addr] = Number(employeeSalaryDecrypt.results[handle]) / 1_000_000;
      }
    });
    return map;
  }, [payroll.employeeAddresses, employeeSalaryHandles.data, employeeSalaryDecrypt.results]);

  // Show toast notifications for payroll messages
  const prevMessage = useRef("");
  useEffect(() => {
    if (!payroll.message || payroll.message === prevMessage.current) return;
    prevMessage.current = payroll.message;
    if (payroll.message.toLowerCase().includes("failed")) {
      notification.error(payroll.message);
    } else if (
      payroll.message.includes("successfully") ||
      payroll.message.includes("Minted") ||
      payroll.message.includes("approved") ||
      payroll.message.includes("removed") ||
      payroll.message.includes("updated") ||
      payroll.message.includes("executed")
    ) {
      notification.success(payroll.message);
    }
  }, [payroll.message]);

  // Not connected — landing page
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="max-w-lg w-full mx-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">Z</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">ZamaPay</h1>
            </div>
            <p className="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
              Confidential onchain payroll powered by Fully Homomorphic Encryption.
              Salaries stay private — only you and your employer can see them.
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h2>
            <p className="text-sm text-gray-400 mb-6">Connect with MetaMask to access the payroll system</p>
            <div className="flex justify-center">
              <RainbowKitCustomConnectButton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connected but no role selected — role selection
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-4">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">Z</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">ZamaPay</h1>
            </div>
            <p className="text-gray-500 text-lg">Welcome to ZamaPay. Please enter your designation</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Employer Card */}
            <button
              onClick={() => setRole("employer")}
              className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-left hover:border-indigo-300 hover:shadow-xl transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors">
                <svg className="w-7 h-7 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Employer</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Manage employees, set encrypted salaries, execute payroll, and view analytics.
              </p>
              <div className="mt-4 flex items-center gap-1 text-indigo-600 text-sm font-medium">
                Enter Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>

            {/* Employee Card */}
            <button
              onClick={() => setRole("employee")}
              className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-left hover:border-green-300 hover:shadow-xl transition-all group"
            >
              <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center mb-5 group-hover:bg-green-100 transition-colors">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Employee</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                View your salary, check payment history, submit reimbursements, and create attestations.
              </p>
              <div className="mt-4 flex items-center gap-1 text-green-600 text-sm font-medium">
                Enter Portal
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Connected: {payroll.accounts?.[0]?.slice(0, 6)}...{payroll.accounts?.[0]?.slice(-4)}
          </p>
        </div>
      </div>
    );
  }

  // Main App with Sidebar
  const accountLabel = payroll.accounts?.[0]
    ? `${payroll.accounts[0].slice(0, 6)}...${payroll.accounts[0].slice(-4)}`
    : "Not connected";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        role={role}
        activeView={role === "employer" ? employerView : employeeView}
        onViewChange={(v: any) => role === "employer" ? setEmployerView(v) : setEmployeeView(v)}
        userName={role === "employer" ? "Admin" : "Employee"}
        accountLabel={accountLabel}
      />

      {/* Main Content */}
      <div className="ml-60 min-h-screen">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setRole(null)}
              className="text-gray-400 hover:text-gray-600 mr-2"
              title="Switch role"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            </button>
            <input
              type="text"
              placeholder="Search transactions..."
              className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-700 w-72 focus:outline-none focus:border-indigo-300"
              readOnly
            />
          </div>
          <div className="flex items-center gap-3">
            {/* FHE Status indicator */}
            {fhevmStatus !== "ready" && (
              <span className={`text-xs px-2.5 py-1 rounded-full ${
                fhevmStatus === "error" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
              }`}>
                FHE: {fhevmStatus}
              </span>
            )}
            {fhevmStatus === "ready" && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-600">FHE Ready</span>
            )}
            <RainbowKitCustomConnectButton />
          </div>
        </div>

        {/* Page Content */}
        <div className="p-6">
          {role === "employer" ? (
            <EmployerContent
              view={employerView}
              payroll={payroll}
              contractInfo={contractInfo}
              payrollContractInfo={payrollContractInfo}
              fhevmInstance={fhevmInstance}
              initialMockChains={initialMockChains}
              employeeSalaryDecrypt={employeeSalaryDecrypt}
              decryptedSalaryMap={decryptedSalaryMap}
            />
          ) : (
            <EmployeeContent
              view={employeeView}
              payroll={payroll}
              contractInfo={contractInfo}
              payrollContractInfo={payrollContractInfo}
              fhevmInstance={fhevmInstance}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmployerContent({
  view,
  payroll,
  contractInfo,
  fhevmInstance,
  initialMockChains,
  employeeSalaryDecrypt,
  decryptedSalaryMap,
}: {
  view: EmployerView;
  payroll: any;
  contractInfo: any;
  payrollContractInfo?: any;
  fhevmInstance?: any;
  initialMockChains?: Readonly<Record<number, string>>;
  employeeSalaryDecrypt?: any;
  decryptedSalaryMap?: Record<string, number>;
}) {
  if (!payroll.isEmployer) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-sm text-gray-500">Only the employer account can access this dashboard.</p>
          <p className="text-xs text-gray-400 font-mono mt-2">Employer: {payroll.employer}</p>
        </div>
      </div>
    );
  }

  switch (view) {
    case "overview": return <OverviewView payroll={payroll} />;
    case "employees": return (
      <EmployeesView
        payroll={payroll}
        fhevmInstance={fhevmInstance}
        initialMockChains={initialMockChains}
        accessControlAddress={contractInfo.accessControl?.address}
        accessControlAbi={contractInfo.accessControl?.abi}
        employeeSalaryDecrypt={employeeSalaryDecrypt}
        decryptedSalaryMap={decryptedSalaryMap}
      />
    );
    case "payroll": return (
      <PayrollView
        payroll={payroll}
        schedulerAddress={contractInfo.scheduler?.address}
        schedulerAbi={contractInfo.scheduler?.abi}
      />
    );
    case "reports": return (
      <ReportsView
        payroll={payroll}
        analyticsAddress={contractInfo.analytics?.address}
        analyticsAbi={contractInfo.analytics?.abi}
        accessControlAddress={contractInfo.accessControl?.address}
        accessControlAbi={contractInfo.accessControl?.abi}
        employeeSalaryDecrypt={employeeSalaryDecrypt}
        decryptedSalaryMap={decryptedSalaryMap}
      />
    );
    case "settings": return <SettingsView payroll={payroll} />;
  }
}

function EmployeeContent({
  view,
  payroll,
  contractInfo,
  payrollContractInfo,
  fhevmInstance,
}: {
  view: EmployeeView;
  payroll: any;
  contractInfo: any;
  payrollContractInfo: any;
  fhevmInstance?: any;
}) {
  if (!payroll.isEmployeeUser) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Not Registered</h3>
          <p className="text-sm text-gray-500">Your wallet is not registered as an employee.</p>
          <p className="text-xs text-gray-400 font-mono mt-2">{payroll.accounts?.[0]}</p>
        </div>
      </div>
    );
  }

  switch (view) {
    case "overview": return (
      <EmployeeOverviewView
        payroll={payroll}
        payrollAddress={payrollContractInfo.address}
        payrollAbi={payrollContractInfo.abi}
      />
    );
    case "salary": return <SalaryView payroll={payroll} />;
    case "attestations": return (
      <AttestationsView
        payroll={payroll}
        attestationAddress={contractInfo.attestation?.address}
        attestationAbi={contractInfo.attestation?.abi}
      />
    );
    case "reimbursements": return (
      <ReimbursementsView
        payroll={payroll}
        payrollAddress={payrollContractInfo.address}
        payrollAbi={payrollContractInfo.abi}
        fhevmInstance={fhevmInstance}
      />
    );
    case "settings": return <EmployeeSettingsView payroll={payroll} />;
  }
}
