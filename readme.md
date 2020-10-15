# WaterLedger Smart Contracts

The WaterLedger platform is a water trading platform across four smart contracts. These contracts have a life of a single financial year, and the scope of a given water scheme.

## Usage

These contracts can be used by any system with the [Truffle command-line tools](https://www.trufflesuite.com/) installed. We also strongly recommend the use of Ganache as a blockchain tool for local testing, as it is extremely fast.

The contracts can be downloaded as a standard git repository, and then the typical tools will be used. A deployment script is included, but that is meant to be illustrative of usage. In the production Water Ledger applications, the contracts are deployed by a bespoke management system.

## Contracts

**OrderBook** - The orderbook is the primary listing of unmatched orders. It is the contract that implements the rules around what is a valid trade. In the current model of WaterLedger orders are listed, whether as a buy or sell order, and the order is then accepted by another licence holder.

**History** - Storage for trades, which consist of accepted orders.

**Zones** - The Zones contract stores balances for each licence, and the details (such as minimum and maximum balances) of each zone. The pattern for deployment of this differs from most contracts, as the contract is deployed and then each zone in the Scheme needs to be added.

**Licences** - Stores licence and water account details to ensure the address has valid access to the system. This implements the [EIP-1753 standard for licences](https://erc1753.org/).

There are additional non-Solidity smart contracts written in DAML that handle the inter-party liability.

The following entity relationship diagram covers the primary fields and the relationships between the contracts. Note that this is not exhaustive, and there are minor contracts such as abstracts and libraries that are not featured.

![Waterledger Contracts ERD](https://waterledger-wp.sgp1.digitaloceanspaces.com/smart-contract-final.png)

## Deployment

In order to obtain a valid instance of all of the contracts, there are several steps that need to be undertaken.

The following deployment steps from Truffle's deployment system demonstrate the required approach.

```javascript
const zones = ["Barron Zone A", "Barron Zone B", "Barron Zone C", "Barron Zone D", "Barron Zone E"];

const orderBookInstance = await deployer.deploy(OrderBook);
const historyInstance = await deployer.deploy(History, orderBookInstance.address);
const licenceInstance = await deployer.deploy(Licences);

const zonesInstance = await deployer.deploy(Zones, orderBookInstance.address);

zones.forEach(async zoneName => {
  await zonesInstance.addZone(web3.utils.toHex(zoneName), 100000, 0, 100000);
});

await orderBookInstance.addHistoryContract(historyInstance.address);
await orderBookInstance.addLicencesContract(licenceInstance.address);
```

## Testing

Testing is done using standard Truffle test harness and JavaScript testing. The testing command is `truffle test`, assuming this feature is available. There is no direct Solidity testing. Testing is to be expanded over the course of WaterLedger's lifecycle.

## Upgradeability

Each financial year a new complete set of contracts is deployed, resetting the system. This why the contracts do not implement upgradeable contract patterns.
