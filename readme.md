# WaterLedger Smart Contracts
The WaterLedger platform is a water trading platform across four smart contracts. These contracts have a life of a single financial year, and the scope of a given water scheme.

## Usage

These contracts can be used by any system with the [Truffle command-line tools](https://www.trufflesuite.com/) installed. We also strongly recommend the use of Ganache as a blockchain tool for local testing, as it is extremely fast.

The contracts can be downloaded as a standard git repository, and then the typical tools will be used.

Note that though a deployment script **is** included as part of this repository, it cannot be used for production builds. This is because Truffle's deployment system cannot handle multiple deployments of the same contract, which is a requirement.

## Contracts

**OrderBook** - The orderbook is the primary listing of unmatched buy and sell orders. It is the contract that implements the rules around what is a valid trade, and how to match.

**History** - Storage for trades, which consist of matched buy and sell orders.

**Zone** - A zone is an ERC-20 token representing the physical water in MegaLitres. There are typically multiple trading zones in a given scheme, and these contract instances allow each user to have multiple balances.

**Licences** - Stores licence and water account details to ensure the address has valid access to the system. This implements the [EIP-1753 standard for licences](https://erc1753.org/).

There are additional non-Solidity smart contracts written in DAML that handle the inter-party liability.

The following entity relationship diagram covers the primary fields and the relationships between the contracts. Note that this is not exhaustive, and there are minor contracts such as abstracts and libraries that are not featured.

![Waterledger Contracts ERD](https://waterledger-wp.sgp1.digitaloceanspaces.com/waterledger-erd.png)

## Deployment

In order to obtain a valid instance of all of the contracts, there are several steps that need to be undertaken.

The following deployment steps from Truffle's deployment system demonstrate the required approach.

```javascript
const zones = ['Barron Zone A', 'Barron Zone B', 'Barron Zone C', 'Barron Zone D', 'Barron Zone E'];

const orderBookInstance = await deployer.deploy(OrderBook);
const historyInstance = await deployer.deploy(History, orderBookInstance.address);
const licenceInstance = await deployer.deploy(Licences);

zones.forEach(async zoneName => {
  const zoneInstance = await deployer.deploy(Zone, 100000, web3.utils.toHex(zoneName), orderBookInstance.address);
  await orderBookInstance.addZone(web3.utils.toHex(zoneName), zoneInstance.address);
});

await orderBookInstance.addHistoryContract(historyInstance.address);
await orderBookInstance.addLicencesContract(licenceInstance.address);
```

## Compilation Warning

Though the Zone contracts are an ERC-20 and all extend an ERC-20 abstract contract, they do not implement an IERC-20 interface. This is due to a compiler bug which prevents compiling of duplicate contracts that implement an interface.

## Testing

Testing is done using standard Truffle test harness and JavaScript testing. The testing command is `truffle test`, assuming this feature is available. There is no direct Solidity testing. Testing is to be expanded over the course of WaterLedger's lifecycle.

## Solidity Versions

Current versions of contracts are built in 0.4.24, with a scheduled project to upgrade them to at least 0.5.x if not the latest 0.6.2. The hesitancy behind the move to the newer version is that at time of writing some standard libraries such as Open Zeppelin had not yet upgraded themselves. This update is scheduled soon.

## Upgradeability
Each financial year a new complete set of contracts is deployed, resetting the system. This why the contracts do not implement upgradeable contract patterns.

## ToDo List
- [x] Update getLatestPrice on match
- [x] Implement user licences as EIP-1753
- [x] Remove unnecessary Grouped Zone functionality
- [ ] Add support for selecting user-specific data
- [ ] Update Solidity version
- [ ] Implement more consistent field names style guide
- [ ] Remove now-unused BokkyPooBah time library
- [ ] Remove setOrderbook() from zone as it is now done in constructor
- [ ] Various optimisations to reduce gas costs
