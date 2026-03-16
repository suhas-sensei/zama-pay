"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "../helper";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
  toHex,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { useReadContract, useReadContracts } from "wagmi";

export const useConfidentialPayroll = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } =
    useWagmiEthers(initialMockChains);

  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: payrollContract } = useDeployedContractInfo({
    contractName: "ConfidentialPayroll",
    chainId: allowedChainId,
  });
  const { data: tokenContract } = useDeployedContractInfo({
    contractName: "ConfidentialPayrollToken",
    chainId: allowedChainId,
  });

  const [message, setMessage] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  type PayrollInfo = Contract<"ConfidentialPayroll"> & { chainId?: number };
  type TokenInfo = Contract<"ConfidentialPayrollToken"> & { chainId?: number };

  const hasPayrollContract = Boolean(payrollContract?.address && payrollContract?.abi);
  const hasTokenContract = Boolean(tokenContract?.address && tokenContract?.abi);
  const hasSigner = Boolean(ethersSigner);

  const getPayrollWriteContract = useCallback(() => {
    if (!hasPayrollContract || !ethersSigner) return undefined;
    return new ethers.Contract(
      payrollContract!.address,
      (payrollContract as PayrollInfo).abi,
      ethersSigner,
    );
  }, [hasPayrollContract, payrollContract, ethersSigner]);

  const getTokenWriteContract = useCallback(() => {
    if (!hasTokenContract || !ethersSigner) return undefined;
    return new ethers.Contract(
      tokenContract!.address,
      (tokenContract as TokenInfo).abi,
      ethersSigner,
    );
  }, [hasTokenContract, tokenContract, ethersSigner]);

  // ─── Read: employer address ──────────────────────────────────────────────
  const employerResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "employer",
    query: { enabled: hasPayrollContract },
  });

  const employer = employerResult.data as string | undefined;
  const isEmployer = useMemo(() => {
    if (!employer || !accounts?.[0]) return false;
    return employer.toLowerCase() === accounts[0].toLowerCase();
  }, [employer, accounts]);

  // ─── Read: employee list ─────────────────────────────────────────────────
  const employeeCountResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "getEmployeeCount",
    query: { enabled: hasPayrollContract },
  });

  const employeeCount = Number(employeeCountResult.data ?? 0);

  const allEmployeesResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "getAllEmployees",
    query: { enabled: hasPayrollContract },
  });

  const employeeAddresses = (allEmployeesResult.data as string[] | undefined) ?? [];

  // ─── Read: check if current user is employee ────────────────────────────
  const isEmployeeResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "isEmployee",
    args: accounts?.[0] ? [accounts[0]] : undefined,
    query: { enabled: hasPayrollContract && Boolean(accounts?.[0]) },
  });

  const isEmployeeUser = Boolean(isEmployeeResult.data);

  // ─── Read: payroll stats ─────────────────────────────────────────────────
  const payrollCountResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "payrollCount",
    query: { enabled: hasPayrollContract },
  });

  const lastPayrollResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "lastPayrollTimestamp",
    query: { enabled: hasPayrollContract },
  });

  // ─── Read: payment token info ───────────────────────────────────────────
  const tokenNameResult = useReadContract({
    address: hasTokenContract ? (tokenContract!.address as `0x${string}`) : undefined,
    abi: hasTokenContract ? (tokenContract as TokenInfo).abi as any : undefined,
    functionName: "name",
    query: { enabled: hasTokenContract },
  });

  const tokenSymbolResult = useReadContract({
    address: hasTokenContract ? (tokenContract!.address as `0x${string}`) : undefined,
    abi: hasTokenContract ? (tokenContract as TokenInfo).abi as any : undefined,
    functionName: "symbol",
    query: { enabled: hasTokenContract },
  });

  const totalSupplyResult = useReadContract({
    address: hasTokenContract ? (tokenContract!.address as `0x${string}`) : undefined,
    abi: hasTokenContract ? (tokenContract as TokenInfo).abi as any : undefined,
    functionName: "totalSupply",
    query: { enabled: hasTokenContract },
  });

  // ─── Read: salary handle for current user (if employee) ─────────────────
  const salaryHandleResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "getEmployeeSalary",
    args: accounts?.[0] ? [accounts[0]] : undefined,
    query: { enabled: hasPayrollContract && isEmployeeUser },
  });

  const mySalaryHandle = salaryHandleResult.data as string | undefined;

  // ─── Read: total budget handle (employer only) ──────────────────────────
  const budgetHandleResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "getTotalPayrollBudget",
    query: { enabled: hasPayrollContract && isEmployer },
  });

  const totalBudgetHandle = budgetHandleResult.data as string | undefined;

  // ─── Read: my token balance handle ──────────────────────────────────────
  const balanceHandleResult = useReadContract({
    address: hasTokenContract ? (tokenContract!.address as `0x${string}`) : undefined,
    abi: hasTokenContract ? (tokenContract as TokenInfo).abi as any : undefined,
    functionName: "balanceOf",
    args: accounts?.[0] ? [accounts[0]] : undefined,
    query: { enabled: hasTokenContract && Boolean(accounts?.[0]) },
  });

  const myBalanceHandle = balanceHandleResult.data as string | undefined;

  // ─── Decrypt hooks ──────────────────────────────────────────────────────
  // Salary decryption
  const salaryDecryptRequests = useMemo(() => {
    if (!mySalaryHandle || mySalaryHandle === ethers.ZeroHash || !hasPayrollContract) return undefined;
    return [{ handle: mySalaryHandle, contractAddress: payrollContract!.address }];
  }, [mySalaryHandle, hasPayrollContract, payrollContract]);

  const salaryDecrypt = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests: salaryDecryptRequests,
  });

  // Balance decryption
  const balanceDecryptRequests = useMemo(() => {
    if (!myBalanceHandle || myBalanceHandle === ethers.ZeroHash || !hasTokenContract) return undefined;
    return [{ handle: myBalanceHandle, contractAddress: tokenContract!.address }];
  }, [myBalanceHandle, hasTokenContract, tokenContract]);

  const balanceDecrypt = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests: balanceDecryptRequests,
  });

  // Budget decryption (employer only)
  const budgetDecryptRequests = useMemo(() => {
    if (!totalBudgetHandle || totalBudgetHandle === ethers.ZeroHash || !hasPayrollContract) return undefined;
    return [{ handle: totalBudgetHandle, contractAddress: payrollContract!.address }];
  }, [totalBudgetHandle, hasPayrollContract, payrollContract]);

  const budgetDecrypt = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests: budgetDecryptRequests,
  });

  // ─── Encryption ─────────────────────────────────────────────────────────
  const { encryptWith: encryptForPayroll } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: payrollContract?.address,
  });

  const { encryptWith: encryptForToken } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: tokenContract?.address,
  });

  // ─── Write: Add Employee ────────────────────────────────────────────────
  const addEmployee = useCallback(
    async (employeeAddress: string, salaryAmount: number) => {
      if (isProcessing || !hasPayrollContract || !instance) return;
      setIsProcessing(true);
      setMessage("Encrypting salary...");
      try {
        const enc = await encryptForPayroll(builder => {
          builder.add64(salaryAmount);
        });
        if (!enc) { setMessage("Encryption failed"); return; }

        const contract = getPayrollWriteContract();
        if (!contract) { setMessage("Contract not available"); return; }

        setMessage("Adding employee...");
        const tx = await contract.addEmployee(employeeAddress, toHex(enc.handles[0]), toHex(enc.inputProof));
        setMessage("Waiting for transaction...");
        await tx.wait();
        setMessage("Employee added successfully!");

        // Refresh data
        employeeCountResult.refetch();
        allEmployeesResult.refetch();
      } catch (e) {
        setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasPayrollContract, instance, encryptForPayroll, getPayrollWriteContract, payrollContract],
  );

  // ─── Write: Update Salary ──────────────────────────────────────────────
  const updateSalary = useCallback(
    async (employeeAddress: string, newSalaryAmount: number) => {
      if (isProcessing || !hasPayrollContract || !instance) return;
      setIsProcessing(true);
      setMessage("Encrypting new salary...");
      try {
        const enc = await encryptForPayroll(builder => {
          builder.add64(newSalaryAmount);
        });
        if (!enc) { setMessage("Encryption failed"); return; }

        const contract = getPayrollWriteContract();
        if (!contract) { setMessage("Contract not available"); return; }

        setMessage("Updating salary...");
        const tx = await contract.updateSalary(employeeAddress, toHex(enc.handles[0]), toHex(enc.inputProof));
        await tx.wait();
        setMessage("Salary updated successfully!");
      } catch (e) {
        setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasPayrollContract, instance, encryptForPayroll, getPayrollWriteContract, payrollContract],
  );

  // ─── Write: Remove Employee ─────────────────────────────────────────────
  const removeEmployee = useCallback(
    async (employeeAddress: string) => {
      if (isProcessing || !hasPayrollContract) return;
      setIsProcessing(true);
      setMessage("Removing employee...");
      try {
        const contract = getPayrollWriteContract();
        if (!contract) { setMessage("Contract not available"); return; }
        const tx = await contract.removeEmployee(employeeAddress);
        await tx.wait();
        setMessage("Employee removed!");
        employeeCountResult.refetch();
        allEmployeesResult.refetch();
      } catch (e) {
        setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasPayrollContract, getPayrollWriteContract],
  );

  // ─── Write: Execute Payroll ─────────────────────────────────────────────
  const executePayroll = useCallback(async () => {
    if (isProcessing || !hasPayrollContract) return;
    setIsProcessing(true);
    setMessage("Executing payroll...");
    try {
      const contract = getPayrollWriteContract();
      if (!contract) { setMessage("Contract not available"); return; }
      const tx = await contract.executePayroll();
      await tx.wait();
      setMessage("Payroll executed successfully!");
      payrollCountResult.refetch();
      lastPayrollResult.refetch();
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, hasPayrollContract, getPayrollWriteContract]);

  // ─── Write: Mint Tokens ─────────────────────────────────────────────────
  const mintTokens = useCallback(
    async (to: string, amount: number) => {
      if (isProcessing || !hasTokenContract) return;
      setIsProcessing(true);
      setMessage("Minting tokens...");
      try {
        const contract = getTokenWriteContract();
        if (!contract) { setMessage("Contract not available"); return; }
        const tx = await contract.mint(to, amount);
        await tx.wait();
        setMessage(`Minted ${amount} cUSDT!`);
        totalSupplyResult.refetch();
        balanceHandleResult.refetch();
      } catch (e) {
        setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, hasTokenContract, getTokenWriteContract],
  );

  // ─── Write: Set Operator (approve payroll contract to spend) ────────────
  const approvePayrollOperator = useCallback(async () => {
    if (isProcessing || !hasTokenContract || !hasPayrollContract) return;
    setIsProcessing(true);
    setMessage("Approving payroll contract as operator...");
    try {
      const contract = getTokenWriteContract();
      if (!contract) { setMessage("Contract not available"); return; }
      const tx = await contract.setOperator(payrollContract!.address, true);
      await tx.wait();
      setMessage("Payroll contract approved as operator!");
    } catch (e) {
      setMessage(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, hasTokenContract, hasPayrollContract, getTokenWriteContract, payrollContract]);

  // ─── Read: isOperator check ─────────────────────────────────────────────
  const isOperatorResult = useReadContract({
    address: hasTokenContract ? (tokenContract!.address as `0x${string}`) : undefined,
    abi: hasTokenContract ? (tokenContract as TokenInfo).abi as any : undefined,
    functionName: "isOperator",
    args: accounts?.[0] && hasPayrollContract ? [accounts[0], payrollContract!.address] : undefined,
    query: { enabled: hasTokenContract && hasPayrollContract && Boolean(accounts?.[0]) },
  });

  const isPayrollApproved = Boolean(isOperatorResult.data);

  // ─── Read: payment history count for current user ───────────────────────
  const paymentHistoryCountResult = useReadContract({
    address: hasPayrollContract ? (payrollContract!.address as `0x${string}`) : undefined,
    abi: hasPayrollContract ? (payrollContract as PayrollInfo).abi as any : undefined,
    functionName: "getPaymentHistoryCount",
    args: accounts?.[0] ? [accounts[0]] : undefined,
    query: { enabled: hasPayrollContract && Boolean(accounts?.[0]) },
  });

  const paymentHistoryCount = Number(paymentHistoryCountResult.data ?? 0);

  return {
    // Contract addresses
    payrollAddress: payrollContract?.address,
    tokenAddress: tokenContract?.address,

    // Role
    employer,
    isEmployer,
    isEmployeeUser,

    // Employee list
    employeeAddresses,
    employeeCount,

    // Stats
    payrollCount: Number(payrollCountResult.data ?? 0),
    lastPayrollTimestamp: Number(lastPayrollResult.data ?? 0),
    paymentHistoryCount,

    // Token info
    tokenName: tokenNameResult.data as string | undefined,
    tokenSymbol: tokenSymbolResult.data as string | undefined,
    totalSupply: totalSupplyResult.data ? Number(totalSupplyResult.data) : 0,

    // Operator
    isPayrollApproved,

    // Encrypted handles
    mySalaryHandle,
    myBalanceHandle,
    totalBudgetHandle,

    // Decrypt functions
    salaryDecrypt,
    balanceDecrypt,
    budgetDecrypt,

    // Write functions
    addEmployee,
    updateSalary,
    removeEmployee,
    executePayroll,
    mintTokens,
    approvePayrollOperator,

    // Signer (for auxiliary contract calls)
    ethersSigner,
    ethersReadonlyProvider,

    // Status
    message,
    isProcessing,
    isConnected,
    chainId,
    accounts,

    // Refetch
    refetchAll: () => {
      employeeCountResult.refetch();
      allEmployeesResult.refetch();
      payrollCountResult.refetch();
      lastPayrollResult.refetch();
      totalSupplyResult.refetch();
      balanceHandleResult.refetch();
      isOperatorResult.refetch();
      isEmployeeResult.refetch();
      salaryHandleResult.refetch();
      budgetHandleResult.refetch();
      paymentHistoryCountResult.refetch();
    },
  };
};
