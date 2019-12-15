const assertThrows = require('./helpers/TestHelpers').assertThrows;
const TradingZones = artifacts.require("TradingZones");

contract("TradingZones", function(accounts) {

    const TradingZone = (values) => { return {name: values[0], exists: values[1]} };

    let tradingZones;
    let owner = accounts[0];
    let nonOwner = accounts[1];

    beforeEach(async () => {
        tradingZones = await TradingZones.new();
    });

    describe('Adds trading zone', () => {

        it('Successfully adds trading zone', async () => {    

            // add a trading zone and assert it was recorded correctly
            await scenarioAddTradingZone({name: 'trading zone 1', expectedTradingZoneId: 1});

            // add another trading zone and assert for good measure
            await scenarioAddTradingZone({name: 'trading zone 2', expectedTradingZoneId: 2});

        });

        it('Errors if non-owner attempts to add trading zone', async () => {
            await assertThrows(
                scenarioAddTradingZone({name: 'trading zone X', expectedTradingZoneId: 1, fromAddress: nonOwner}),
                'Expected error because non-owner attempted to add trading zone'
            );
        });

    });

    describe('Checks is registered trading zone', () => {

        it('Successfully checks if id is registered trading zone', async () => {

            let precheckIsTradingZone = await tradingZones.isTradingZone(1, {from: owner});
            assert.isFalse(precheckIsTradingZone, 'Trading zone should not yet be registered');

            // add a trading zone
            await scenarioAddTradingZone({name: 'Trading zone 1', expectedTradingZoneId: 1});

            let isTradingZone = await tradingZones.isTradingZone(1, {from: owner});
            assert.isTrue(isTradingZone, 'Trading zone should be registered');

        });

    });

    async function scenarioAddTradingZone({expectedTradingZoneId, name, fromAddress = owner}){
        let preTradingZone = TradingZone(await tradingZones.tradingZoneById(expectedTradingZoneId, {from: fromAddress}));
        assert.isFalse(preTradingZone.exists, 'Precheck failed - trading zone exists before it is created.')

        await tradingZones.addTradingZone(name, {from: fromAddress});

        let postTradingZone = TradingZone(await tradingZones.tradingZoneById(expectedTradingZoneId, {from: fromAddress}));
        assert.isTrue(postTradingZone.exists, 'Trading zone does not exist after creation.')
    }

});