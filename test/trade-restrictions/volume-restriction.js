const getTime = require('date-fns/getTime');
const addDays = require('date-fns/addDays');
const addWeeks = require('date-fns/addWeeks');
const addMonths = require('date-fns/addMonths');
const addYears = require('date-fns/addYears');
const VolumeRestriction = artifacts.require("./trade-restrictions/VolumeRestriction");

const unixTime = (date) => getTime(date) / 1000;

contract("VolumeRestriction", function(accounts) {

    const VolumePeriod = (values) => { return {keyHash: values[0], volume: values[1].toNumber(), periodType: values[2].toNumber(), startMonth: values[3].toNumber(), endMonth: values[4].toNumber()}; }

    let keyHash = web3.utils.soliditySha3('SomePrefix', 1);
    let owner = accounts[0];
    let volumeRestriction;

    describe('Adds volume restrictions', () => {        

        beforeEach(async () => {
            volumeRestriction = await VolumeRestriction.new();
        });

        it('Successfully adds a volume restriction (default calendar)', async () => {

            // setup expected values
            let expected = {keyHash: keyHash, volume: 1000, periodType: 0, startMonth: 1, endMonth: 12};

            // add the volume restriction
            await scenarioAddVolumeRestriction({
                id: expected.keyHash,
                volume: expected.volume,
                type: expected.periodType
            });

            // make sure it was recorded correctly
            let actualResult = VolumePeriod(await volumeRestriction.maxVolumeByKey(expected.keyHash, {from: owner}));
            assert.deepEqual(actualResult, expected, 'Volume restriction not recorded correctly');
            
        });

        it('Successfully adds a monthly volume restriction', async () => {

            // setup expected values
            let expected = {
                keyHash: keyHash, 
                volume: 1000, 
                periodType: 1, // monthly
                startMonth: 1, 
                endMonth: 12
            };

            // add the volume restriction
            await scenarioAddVolumeRestriction({
                id: expected.keyHash,
                volume: expected.volume,
                type: expected.periodType
            });

            // make sure it was recorded correctly
            let actualResult = VolumePeriod(await volumeRestriction.maxVolumeByKey(expected.keyHash, {from: owner}));
            assert.deepEqual(actualResult, expected, 'Volume restriction not recorded correctly');
            
        });

        it('Successfully adds a volume restriction (custom calendar)', async () => {

            // setup expected values
            let expected = {keyHash: keyHash, volume: 1000, periodType: 0, startMonth: 7, endMonth: 6};

            // add the volume restriction
            await scenarioAddVolumeRestrictionCustomCalendar({
                id: expected.keyHash,
                volume: expected.volume,
                type: expected.periodType,
                startMonth: expected.startMonth,
                endMonth: expected.endMonth
            });

            // make sure it was recorded correctly
            let actualResult = VolumePeriod(await volumeRestriction.maxVolumeByKey(expected.keyHash, {from: owner}));
            assert.deepEqual(actualResult, expected, 'Volume restriction not recorded correctly');
            
        });        

    });

    describe('Updates current trading volume', async () => {

        beforeEach(async () => {
            volumeRestriction = await VolumeRestriction.new();
        });


        it('Successfully updates current trading volume', async () => {

            let maxVolume = 1500;

            // setup volume restriction
            await scenarioAddVolumeRestriction({
                id: keyHash,
                volume: maxVolume,
                type: 0 // per day
            });
        
            let onDate = new Date(Date.UTC(2018, 10, 13));
            let todayUnix = unixTime(onDate)

            // precheck current volume is zero
            let preVolume = await volumeRestriction.currentVolumeByKey(keyHash, todayUnix, {from: owner});
            assert.equal(preVolume.toNumber(), 0, 'Precheck failed initial trading volume must be zero');

            // update volume to new value
            let incrementVolumeBy = 1000;
            await volumeRestriction.incrementCurrentVolume(keyHash, incrementVolumeBy, todayUnix, {from: owner});

            // postcheck current volume should be incremented
            let postVolume = await volumeRestriction.currentVolumeByKey(keyHash, todayUnix, {from: owner});
            assert.equal(postVolume.toNumber(), incrementVolumeBy, 'Failed to increment trading volume');

        });

    });

    describe('Checks trading volume is within trading limits', async () => {

        describe('Per Day', async () => {

            beforeEach(async () => {
                volumeRestriction = await VolumeRestriction.new();
            });

            it('Returns true if within volume trading limits', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 0 // per day
                });

                let currentVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 10, 13));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: currentVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 100;                
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, unixTime(onDate), {from: owner});
                assert.isTrue(canTrade, 'Should be able to trade as within max limit');

            });

            it('Returns false if exceeded volume trading limits', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 0 // per day
                });

                let currentVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 10, 13));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: currentVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 501;
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, unixTime(onDate), {from: owner});
                assert.isFalse(canTrade, 'Should be not able to trade as exceeds max limit');

            });

            it('Resets trading volume per day', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 0 // per day
                });

                let currentVolume = 1500;
                let onDate = new Date(Date.UTC(2018, 10, 13));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: currentVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 500;
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, unixTime(onDate), {from: owner});
                assert.isFalse(canTrade, 'Should be not able to trade as exceeds max limit');

                // check test volume next day
                let nextDay = addDays(onDate, 1);
                let nextDayCanTrade = await volumeRestriction.canTrade(keyHash, testVolume, unixTime(nextDay), {from: owner});
                assert.isTrue(nextDayCanTrade, 'Should be able to trade as within max limit');

            });

        });

        describe('Per Month', async () => {

            beforeEach(async () => {
                volumeRestriction = await VolumeRestriction.new();
            });

            it('Returns true if within volume trading limits', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 1 // per month
                });

                let incrementVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 11, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                incrementVolume = 250;
                onDate = addWeeks(onDate, 2);

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 100;                
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isTrue(canTrade, 'Should be able to trade as within max limit');
            });

            it('Returns false if exceeded volume trading limits', async () => {
                
                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 1 // per month
                });

                let incrementVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 10, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                incrementVolume = 1000;
                onDate = addWeeks(onDate, 2);

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 100;                
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isFalse(canTrade, 'Should be not able to trade exceeds max limit');

            });

            it('Resets trading volume per month', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 1 // per month
                });

                let currentVolume = 1500;
                let onDate = new Date(Date.UTC(2018, 11, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: currentVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 500;
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isFalse(canTrade, 'Should be not able to trade as exceeds max limit');

                // check test volume next day
                let nextMonth = addMonths(onDate, 1);
                let nextDayCanTrade = await volumeRestriction.canTrade(keyHash, testVolume, unixTime(nextMonth), {from: owner});
                assert.isTrue(nextDayCanTrade, 'Should be able to trade as within max limit');

            });

        });

        describe('Per Year (calendar)', async () => {

            beforeEach(async () => {
                volumeRestriction = await VolumeRestriction.new();
            });

            it('Returns true if within volume trading limits', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 2 // per year
                });

                let incrementVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 1, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                incrementVolume = 250;
                onDate = addMonths(onDate, 6);

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 100;                
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isTrue(canTrade, 'Should be able to trade as within max limit');

            });

            it('Returns false if exceeded volume trading limits', async () => {
                
                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 2 // per year
                });

                let incrementVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 1, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                incrementVolume = 1000;
                onDate = addMonths(onDate, 6);

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 100;                
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isFalse(canTrade, 'Should be not able to trade exceeds max limit');

            });

            it('Resets trading volume per year', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestriction({
                    id: keyHash,
                    volume: maxVolume,
                    type: 2 // per year
                });

                let currentVolume = 1500;
                let onDate = new Date(Date.UTC(2018, 1, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: currentVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 500;
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isFalse(canTrade, 'Should be not able to trade as exceeds max limit');

                // check test volume next day
                let nextYear = addYears(onDate, 1);
                let nextDayCanTrade = await volumeRestriction.canTrade(keyHash, testVolume, unixTime(nextYear), {from: owner});
                assert.isTrue(nextDayCanTrade, 'Should be able to trade as within max limit');

            });

        });

        describe('Per Year (custom)', async () => {

            beforeEach(async () => {
                volumeRestriction = await VolumeRestriction.new();
            });

            it('Returns true if within volume trading limits (pre jan)', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestrictionCustomCalendar({
                    id: keyHash,
                    volume: maxVolume,
                    type: 2, // per year
                    startMonth: 7,
                    endMonth: 6
                });

                let incrementVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 6, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                incrementVolume = 250;
                onDate = addMonths(onDate, 2);

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 100;                
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isTrue(canTrade, 'Should be able to trade as within max limit');

            });

            it('Returns true if within volume trading limits (post jan)', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestrictionCustomCalendar({
                    id: keyHash,
                    volume: maxVolume,
                    type: 2, // per year
                    startMonth: 7,
                    endMonth: 6
                });

                let incrementVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 6, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                incrementVolume = 250;
                onDate = addMonths(onDate, 8);

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 100;                
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isTrue(canTrade, 'Should be able to trade as within max limit');

            });

            it('Returns false if exceeded volume trading limits', async () => {
                
                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestrictionCustomCalendar({
                    id: keyHash,
                    volume: maxVolume,
                    type: 2, // per year
                    startMonth: 7,
                    endMonth: 6
                });

                let incrementVolume = 1000;
                let onDate = new Date(Date.UTC(2018, 7, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                incrementVolume = 1000;
                onDate = addMonths(onDate, 8);

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: incrementVolume,
                    onDate: unixTime(onDate)
                });

                // check test volume
                let testVolume = 100;                
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isFalse(canTrade, 'Should be not able to trade exceeds max limit');

            });

            it('Resets trading volume per year, according to customised calendar', async () => {

                let maxVolume = 1500;

                // setup volume restriction
                await scenarioAddVolumeRestrictionCustomCalendar({
                    id: keyHash,
                    volume: maxVolume,
                    type: 2, // per year
                    startMonth: 7,
                    endMonth: 6
                });

                let currentVolume = 1500;
                let onDate = new Date(Date.UTC(2018, 7, 1));

                // increment trading volume within max limit
                await scenarioIncrementCurrentVolume({
                    id: keyHash,                
                    incrementVolumeBy: currentVolume,
                    onDate: unixTime(onDate)
                });

                onDate = new Date(Date.UTC(2019, 2, 1));

                // check test volume
                let testVolume = 500;
                let canTrade = await volumeRestriction.canTrade(keyHash, testVolume, (unixTime(onDate)), {from: owner});
                assert.isFalse(canTrade, 'Should be not able to trade as exceeds max limit');

                // check test volume next day
                let nextYear = getTime(new Date(2019, 7, 1));
                let nextDayCanTrade = await volumeRestriction.canTrade(keyHash, testVolume, unixTime(nextYear), {from: owner});
                assert.isTrue(nextDayCanTrade, 'Should be able to trade as within max limit');

            });

        });

    });

    async function scenarioAddVolumeRestriction({id, volume, type}) {
        await volumeRestriction.addMaxVolume(id, volume, type, {from: owner}); 
    }

    async function scenarioAddVolumeRestrictionCustomCalendar({id, volume, type, startMonth, endMonth}) {
        await volumeRestriction.addMaxVolumeWithCustomYear(id, volume, type, startMonth, endMonth, {from: owner}); 
    }

    async function scenarioIncrementCurrentVolume({id, incrementVolumeBy, onDate}) {        
    
        let preVolume = (await volumeRestriction.currentVolumeByKey(id, onDate, {from: owner})).toNumber();

        // update volume to new value
        await volumeRestriction.incrementCurrentVolume(id, incrementVolumeBy, onDate, {from: owner});

        // postcheck current volume should be incremented
        let postVolume = (await volumeRestriction.currentVolumeByKey(id, onDate, {from: owner})).toNumber();
        assert.equal(postVolume, preVolume + incrementVolumeBy, 'Failed to increment trading volume');

    }


});