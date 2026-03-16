import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // 1. Deploy the ConfidentialPayrollToken (cUSDT)
  const token = await deploy("ConfidentialPayrollToken", {
    from: deployer,
    args: ["Confidential USDT", "cUSDT"],
    log: true,
  });
  console.log(`ConfidentialPayrollToken deployed at: ${token.address}`);

  // 2. Deploy the ConfidentialPayroll contract
  const payroll = await deploy("ConfidentialPayroll", {
    from: deployer,
    args: [token.address],
    log: true,
  });
  console.log(`ConfidentialPayroll deployed at: ${payroll.address}`);

  // 3. Deploy PayrollAccessControl
  const accessControl = await deploy("PayrollAccessControl", {
    from: deployer,
    args: [],
    log: true,
  });
  console.log(`PayrollAccessControl deployed at: ${accessControl.address}`);

  // 4. Deploy SalaryAttestation
  const attestation = await deploy("SalaryAttestation", {
    from: deployer,
    args: [payroll.address],
    log: true,
  });
  console.log(`SalaryAttestation deployed at: ${attestation.address}`);

  // 5. Deploy PayrollScheduler
  const scheduler = await deploy("PayrollScheduler", {
    from: deployer,
    args: [payroll.address],
    log: true,
  });
  console.log(`PayrollScheduler deployed at: ${scheduler.address}`);

  // 6. Deploy PayrollAnalytics
  const analytics = await deploy("PayrollAnalytics", {
    from: deployer,
    args: [payroll.address],
    log: true,
  });
  console.log(`PayrollAnalytics deployed at: ${analytics.address}`);

  // 7. Link contracts together
  const { ethers } = hre;
  const payrollContract = await ethers.getContractAt("ConfidentialPayroll", payroll.address);
  await (await payrollContract.setAccessControl(accessControl.address)).wait();
  console.log("Linked: AccessControl → Payroll");
  await (await payrollContract.setAttestationContract(attestation.address)).wait();
  console.log("Linked: Attestation → Payroll");
  await (await payrollContract.setScheduler(scheduler.address)).wait();
  console.log("Linked: Scheduler → Payroll");

  console.log("\n=== All contracts deployed ===");
  console.log(`Token:          ${token.address}`);
  console.log(`Payroll:        ${payroll.address}`);
  console.log(`AccessControl:  ${accessControl.address}`);
  console.log(`Attestation:    ${attestation.address}`);
  console.log(`Scheduler:      ${scheduler.address}`);
  console.log(`Analytics:      ${analytics.address}`);
};

export default func;
func.id = "deploy_confidential_payroll";
func.tags = ["ConfidentialPayroll"];
