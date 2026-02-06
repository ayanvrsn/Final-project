const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const RewardToken = await hre.ethers.getContractFactory("RewardToken");
  const token = await RewardToken.deploy("Crowd Reward", "CRWD");
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("RewardToken:", tokenAddr);

  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const crowd = await Crowdfunding.deploy(tokenAddr);
  await crowd.waitForDeployment();
  const crowdAddr = await crowd.getAddress();
  console.log("Crowdfunding:", crowdAddr);

  const tx = await token.setMinter(crowdAddr);
  await tx.wait();
  console.log("Minter set:", crowdAddr);

  console.log("\n== COPY TO FRONTEND config.js ==");
  console.log("TOKEN_ADDRESS=", tokenAddr);
  console.log("CROWDFUND_ADDRESS=", crowdAddr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
