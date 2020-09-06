const Zone = artifacts.require("Zone");
const OrderBook = artifacts.require("OrderBook");
const Licences = artifacts.require("Licences");
const History = artifacts.require("History");

const zones = ["Barron Zone A", "Barron Zone B", "Barron Zone C", "Barron Zone D", "Barron Zone E"];

module.exports = async deployer => {
  // This is duplicated due to a deployer bug which causes the first deployed
  // contract to not return a usable instance

  let orderBookInstance = await deployer.deploy(OrderBook, "Test Scheme", 2021);
  orderBookInstance = await deployer.deploy(OrderBook, "Test Scheme", 2021);
  // 2.6692672 | 6673168 // full
  // 2.3518000 | 5879500 // with licence code without sorting
  // 2.1609144 | 5402286 // private variables
  // 2.3258588 | 5814647 // without licence code
  // 2.0732964 | 5183241 // without licence code and sorting

  // public variables = 470,000
  // libraries (sorting, safemath) = 630,000
  // licence code = 860,000

  // console.log(orderBookInstance);

  const historyInstance = await deployer.deploy(History, orderBookInstance.address);

  const licencesInstance = await deployer.deploy(Licences);

  zones.forEach(async zoneName => {
    const zoneInstance = await deployer.deploy(Zone, 100000, zoneName, orderBookInstance.address, 0, 10000);
    await orderBookInstance.addZone(web3.utils.toHex(zoneName), zoneInstance.address);
  });

  await orderBookInstance.addHistoryContract(historyInstance.address);
  await orderBookInstance.addLicencesContract(licencesInstance.address);

  // 5.2 eth = $2,562.15
};
