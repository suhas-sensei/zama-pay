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

  // 2. Deploy the ConfidentialPayroll contract, pointing to the token
  const payroll = await deploy("ConfidentialPayroll", {
    from: deployer,
    args: [token.address],
    log: true,
  });

  console.log(`ConfidentialPayroll deployed at: ${payroll.address}`);
};

export default func;
func.id = "deploy_confidential_payroll";
func.tags = ["ConfidentialPayroll"];
