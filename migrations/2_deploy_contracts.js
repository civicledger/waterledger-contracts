const Zones = artifacts.require("Zones");
const OrderBook = artifacts.require("OrderBook");
const Licences = artifacts.require("Licences");
const History = artifacts.require("History");

const zones = [
  { name: "Barron Zone A", supply: 100000, max: 1000000, min: 1000000 },
  { name: "Barron Zone B", supply: 100000, max: 1000000, min: 1000000 },
  { name: "Barron Zone C", supply: 100000, max: 100000000, min: 0 },
  { name: "Barron Zone D", supply: 100000, max: 1000000, min: 1000000 },
  { name: "Barron Zone E", supply: 100000, max: 1000000, min: 1000000 },
];

module.exports = async deployer => {
  // This is duplicated due to a deployer bug which causes the first deployed
  // contract to not return a usable instance

  let orderBookInstance = await deployer.deploy(OrderBook, "Test Level 1 Resource", 2022);
  orderBookInstance = await deployer.deploy(OrderBook, "Test Level 1 Resource", 2022);

  const historyInstance = await deployer.deploy(History, orderBookInstance.address);
  const licencesInstance = await deployer.deploy(Licences, orderBookInstance.address);
  const zonesInstance = await deployer.deploy(Zones, orderBookInstance.address);

  zones.forEach(async zone => {
    await zonesInstance.addZone(web3.utils.toHex(zone.name), zone.supply, zone.min, zone.max);
  });

  await orderBookInstance.addHistoryContract(historyInstance.address);
  await orderBookInstance.addZonesContract(zonesInstance.address);
  await orderBookInstance.addLicencesContract(licencesInstance.address);
};
