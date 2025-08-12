const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy Mock USDT
  const USDT = await hre.ethers.getContractFactory("USDT");
  const usdt = await USDT.deploy();
  await usdt.waitForDeployment();
  console.log("USDT deployed to:", await usdt.getAddress());

  // Deploy GameToken (GT)
  const GameToken = await hre.ethers.getContractFactory("GameToken");
  const gameToken = await GameToken.deploy();
  await gameToken.waitForDeployment();
  console.log("GameToken deployed to:", await gameToken.getAddress());

  // Deploy TokenStore
  const gtPerUsdt = hre.ethers.parseUnits("1", 18); // 1 GT per 1 USDT (1e18)
  const TokenStore = await hre.ethers.getContractFactory("TokenStore");
  const tokenStore = await TokenStore.deploy(await usdt.getAddress(), await gameToken.getAddress(), gtPerUsdt);
  await tokenStore.waitForDeployment();
  console.log("TokenStore deployed to:", await tokenStore.getAddress());

  // Set TokenStore address in GameToken contract
  await gameToken.setTokenStore(await tokenStore.getAddress());
  console.log("GameToken's tokenStore address set");

  // Deploy PlayGame
  const PlayGame = await hre.ethers.getContractFactory("PlayGame");
  const playGame = await PlayGame.deploy(await gameToken.getAddress(), deployer.address); // Using deployer as operator for now
  await playGame.waitForDeployment();
  console.log("PlayGame deployed to:", await playGame.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});