const Zone = artifacts.require("Zone");
const OrderBook = artifacts.require("OrderBook");
const Licences = artifacts.require("Licences");
const History = artifacts.require("History");

const zones = ['Barron Zone A', 'Barron Zone B', 'Barron Zone C', 'Barron Zone D', 'Barron Zone E'];

module.exports = async (deployer) => {


  // This is duplicated due to a deployer bug which causes the first deployed
  // contract to not return a usable instance

  let orderBookInstance = await deployer.deploy(OrderBook, "Test Scheme");
  orderBookInstance = await deployer.deploy(OrderBook, "Test Scheme");

  const historyInstance = await deployer.deploy(History, orderBookInstance.address);

  const licencesInstance = await deployer.deploy(Licences);

  zones.forEach(async zoneName => {
    const zoneInstance = await deployer.deploy(Zone, 100000, zoneName, orderBookInstance.address, 0, 10000);
    await orderBookInstance.addZone(web3.utils.toHex(zoneName), zoneInstance.address);
  });
  // uint256 supply, bytes32 name, address orderBook, uint256 min, uint256 max
  await orderBookInstance.addHistoryContract(historyInstance.address);
  await orderBookInstance.addLicencesContract(licencesInstance.address);
};