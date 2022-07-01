const Level0Resources = artifacts.require("Level0Resources");
const OrderBook = artifacts.require("OrderBook");
const Licences = artifacts.require("Licences");
const History = artifacts.require("History");

const level0Resources = [
  { name: "Barron Level0Resource A", supply: 100000, max: 1000000, min: 1000000 },
  { name: "Barron Level0Resource B", supply: 100000, max: 1000000, min: 1000000 },
  { name: "Barron Level0Resource C", supply: 100000, max: 100000000, min: 0 },
  { name: "Barron Level0Resource D", supply: 100000, max: 1000000, min: 1000000 },
  { name: "Barron Level0Resource E", supply: 100000, max: 1000000, min: 1000000 },
];

module.exports = async deployer => {
  // This is duplicated due to a deployer bug which causes the first deployed
  // contract to not return a usable instance

  let orderBookInstance = await deployer.deploy(OrderBook, "Test Scheme", 2022);
  orderBookInstance = await deployer.deploy(OrderBook, "Test Scheme", 2022);

  const historyInstance = await deployer.deploy(History, orderBookInstance.address);
  const licencesInstance = await deployer.deploy(Licences, orderBookInstance.address);
  const level0ResourcesInstance = await deployer.deploy(Level0Resources, orderBookInstance.address);

  level0Resources.forEach(async level0Resource => {
    await level0ResourcesInstance.addLevel0Resource(
      web3.utils.toHex(level0Resource.name),
      level0Resource.supply,
      level0Resource.min,
      level0Resource.max
    );
  });

  await orderBookInstance.addHistoryContract(historyInstance.address);
  await orderBookInstance.addLevel0ResourcesContract(level0ResourcesInstance.address);
  await orderBookInstance.addLicencesContract(licencesInstance.address);
};
