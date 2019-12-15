const getTime = require('date-fns/getTime')
const addYears = require('date-fns/addYears')
const addDays = require('date-fns/addDays')
const subDays = require('date-fns/subDays')
const subYears = require('date-fns/subYears');
const assertThrows = require('../helpers/TestHelpers').assertThrows;
const TradingPeriodRestriction = artifacts.require("./trade-restrictions/TradingPeriodRestriction");

const unixTime = (date) => getTime(date) / 1000;
const now = () => new Date(Date.UTC(2018, 10, 13));

contract("TradingPeriodRestriction", function(accounts) {

    let TradingPeriod = (values) => { return {startDate: values[0], endDate: values[1]} };

    let keyHash;

    let owner = accounts[0];
    let tradingPeriodRestriction;

    describe('Add Trading Period', () => {

        beforeEach(async () => {
            keyHash = web3.utils.soliditySha3(1);
    
            tradingPeriodRestriction = await TradingPeriodRestriction.new();
        });

        it('Successfully adds a trading period for a particular generic key', async () => {
    
            await scenarioAddTradingPeriod({
                keyHash,
                startDate: unixTime(now()),
                endDate: unixTime(addYears(now(), 1))
            });
        
        });
    
        it('Errors given invalid trading period dates', async () => {

            let startDate = unixTime(addYears(now(), 1))
            let endDate = unixTime(now());
    
            await assertThrows(
                tradingPeriodRestriction.addTradingPeriod(keyHash, startDate, endDate, {from: owner}),
                'Should error with invalid period dates'               
            );

        });

    });

    describe('Change Trading Period', () => {

        beforeEach(async () => {
            keyHash = web3.utils.soliditySha3(1);
    
            tradingPeriodRestriction = await TradingPeriodRestriction.new();
        });

        it('Successfully changes a trading period for a particular generic key', async () => {
            
            await scenarioAddTradingPeriod({
                keyHash,
                startDate: unixTime(now()),
                endDate: unixTime(addYears(now(), 1))
            });

            startDate = unixTime(addDays(now(), 1));
            endDate = unixTime(addYears(addDays(now(), 1), 1));
    
            await tradingPeriodRestriction.changeTradingPeriod(keyHash, 0, startDate, endDate, {from: owner});
    
            actualPeriod = TradingPeriod(await tradingPeriodRestriction.tradingPeriodByKey(keyHash, 0, {from: owner}));
            assert.equal(actualPeriod.startDate, startDate, 'Start date has not changed');
            assert.equal(actualPeriod.endDate, endDate, 'End date has not changed');

        });
    
        it('Errors given invalid trading period dates', async () => {

            await scenarioAddTradingPeriod({
                keyHash,
                startDate: unixTime(now()),
                endDate: unixTime(addYears(now(), 1))
            });
    
            startDate = unixTime(addYears(now(), 1))
            endDate = unixTime(now());

            await assertThrows(
                tradingPeriodRestriction.changeTradingPeriod(keyHash, 0, startDate, endDate, {from: owner}),
                'Should error with invalid period dates'               
            );

        });

    });

    describe('Checks trade is valid based on valid trading period', () => {

        beforeEach(async () => {
            keyHash = web3.utils.soliditySha3(1);
    
            tradingPeriodRestriction = await TradingPeriodRestriction.new();
            
            // add a valid period
            await scenarioAddTradingPeriod({
                keyHash,
                startDate: unixTime(subDays(now(), 1)),
                endDate: unixTime(addYears(now(), 1))
            });

        });

        it('returns true if they trading within a valid trading period', async () => {

            let result = await tradingPeriodRestriction.canTrade(keyHash, unixTime(now()), {from: owner});
            assert.isTrue(result, 'Should be able to trade in valid period');

        });

        it('returns true if they are trading with an open end date', async () => {

            let newKeyHash = web3.utils.soliditySha3(2);
    
            // add a valid period
            await scenarioAddTradingPeriod({
                keyHash: newKeyHash,
                startDate: unixTime(subDays(now(), 1)),
                endDate: 0 // open ended date
            });

            let testDate = unixTime(addYears(now(), 5));
            let result = await tradingPeriodRestriction.canTrade(newKeyHash, testDate, {from: owner});
            assert.isTrue(result, 'Should be able to trade in valid period');

        });

        it('returns false if they trade before a valid trading period', async () => {

            let result = await tradingPeriodRestriction.canTrade(keyHash, unixTime(subDays(now(), 2)), {from: owner, gas: 3000000});
            assert.isFalse(result, 'Should not be able to trade before a valid period');

        });

        it('returns false if they trade after a valid trading period', async () => {

            let result = await tradingPeriodRestriction.canTrade(keyHash, unixTime(subYears(now(), 2)), {from: owner, gas: 3000000});
            assert.isFalse(result, 'Should not be able to trade after a valid period');

        });

    });


    async function scenarioAddTradingPeriod({keyHash, startDate, endDate}) {
        await tradingPeriodRestriction.addTradingPeriod(keyHash, startDate, endDate, {from: owner});
    
        let actualPeriod = TradingPeriod(await tradingPeriodRestriction.tradingPeriodByKey(keyHash, 0, {from: owner}));
        assert.equal(actualPeriod.startDate, startDate, 'Start date is not same as input');
        assert.equal(actualPeriod.endDate, endDate, 'End date is not same as input');
    }
    

});