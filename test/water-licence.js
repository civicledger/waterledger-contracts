const getTime = require('date-fns/getTime')
const addYears = require('date-fns/addYears')
const subDays = require('date-fns/subDays')
const assertThrows = require('./helpers/TestHelpers').assertThrows;
const Users = artifacts.require("Users");
const Roles = artifacts.require("Roles");
const TradingZones = artifacts.require("TradingZones");
const Water = artifacts.require("Water");
const WaterLicence = artifacts.require("WaterLicence");

contract("WaterLicence", function(accounts) {

    const Licence = (values) => {
        return {
            licenseeAddress: values[0],
            reference: values[1],
            authorityUserId: values[2].toNumber(),
            tradingZoneId: values[3].toNumber(),
            tradingZoneName: values[4],
            administrativePlan: values[5],
            startDate: values[6].toNumber(),
            endDate: values[7].toNumber()
        };
    };

    let usersContract;
    let rolesContract;
    let tradingZonesContract;
    let waterTokenContract;
    let waterLicenceContract;

    // addresses
    const owner = accounts[0];
    const waterAuthorityAddress = accounts[1];
    const licenseeAddress = accounts[2];
    const nonWaterAuthorityAddress = accounts[3];

    let reference;
    let startDate;
    let endDate;
    let authorityUserId;
    let tradingZoneId;
    let tradingZoneName = 'trading zone 1';
    let administrativePlan = 'AP12345';

    const unixTime = (date) => getTime(date) / 1000;

    beforeEach(async () => {

        usersContract = await Users.new();
        rolesContract = await Roles.new(usersContract.address);
        tradingZonesContract = await TradingZones.new();
        waterTokenContract = await Water.new(1000000);
        waterLicenceContract = await WaterLicence.new(usersContract.address, rolesContract.address, tradingZonesContract.address, waterTokenContract.address);

        // setup a water authority user
        await usersContract.addUser(waterAuthorityAddress, {from: owner});
        await rolesContract.assignRole('WaterAuthority', 1, {from: owner});

        // only water licence can allocate water, tell water token what the water licence address is
        waterTokenContract.setWaterLicence(waterLicenceContract.address);

        // setup trading zone
        await tradingZonesContract.addTradingZone(tradingZoneName, {from: owner});

        reference = 'referef';
        let today = new Date(Date.UTC(2018, 10, 13));
        startDate = subDays(today, 1);
        endDate = addYears(today, 1);
        authorityUserId = 1;
        tradingZoneId = 1;

    });

    describe('Issues water licences', () => {

        it('Successfully issues a water licence', async () => {

            let result = await waterLicenceContract.issueLicence(licenseeAddress, reference, tradingZoneId, unixTime(startDate), unixTime(endDate), administrativePlan, {from: waterAuthorityAddress});

            let expectedLicenceId = 0;
            let actualLicence = Licence(await waterLicenceContract.getLicenceById(expectedLicenceId, {from: owner}));
            assert.deepEqual(actualLicence, {licenseeAddress, reference, authorityUserId, tradingZoneId, tradingZoneName, administrativePlan, startDate: unixTime(startDate), endDate: unixTime(endDate)});

            let issuedLog = result.logs[0];

            assert.equal(issuedLog.event, 'LicenceIssued', 'LicenceIssued Event should have been triggered');
            assert.equal(issuedLog.args.waterLicenceId, expectedLicenceId, 'Licence ID should be 0');
            assert.equal(issuedLog.args.to, licenseeAddress, 'addressee on issued licence is incorrect');

        });

        it('Successfully issues a water licence and allocates it water', async () => {

            let anotherReference = '2';

            let volume = 1000;
            await waterLicenceContract.issueLicenceAndAllocate(licenseeAddress, anotherReference, tradingZoneId, unixTime(startDate), unixTime(endDate), administrativePlan, volume, {from: waterAuthorityAddress});

            let expectedLicenceId = 0;
            let actualLicence = Licence(await waterLicenceContract.getLicenceById(expectedLicenceId, {from: owner}));
            assert.deepEqual(actualLicence, {licenseeAddress, reference: anotherReference, authorityUserId, tradingZoneId, tradingZoneName, administrativePlan, startDate: unixTime(startDate), endDate: unixTime(endDate)});

            let actualAllocation = await waterLicenceContract.allocationById(expectedLicenceId, {from: owner});
            assert.equal(actualAllocation, volume, 'Allocation not recorded correctly');

        });

        it('Errors if non water authority attempts to issue a water license', async () => {

            await assertThrows(
                waterLicenceContract.issueLicence(licenseeAddress, 'aaaa', tradingZoneId, unixTime(startDate), unixTime(endDate), administrativePlan, {from: nonWaterAuthorityAddress}),
                'Only water authority can issue water licences'
            );

        });

        it('Errors if you try to issue a licence to no address', async () => {

            await assertThrows(
                waterLicenceContract.issueLicence(0, 'aaaa', tradingZoneId, unixTime(startDate), unixTime(endDate), administrativePlan, {from: waterAuthorityAddress}),
                'Cannot issue licence for address 0',
                'invalid address'
            );

        });

        it('Errors if you try to issue a licence with a validity period start which is after the end', async () => {

            let invalidStartDate = addYears(Date.now(), 1);
            let invalidEndDate = subDays(Date.now(), 1);

            await assertThrows(
                waterLicenceContract.issueLicence(licenseeAddress, 'aaaa', tradingZoneId, unixTime(invalidStartDate), unixTime(invalidEndDate), administrativePlan, {from: waterAuthorityAddress}),
                'Must have valid period dates',
                'invalid number value'
            );

        });

        it('Errors if issuing a licence for an invalid/unregistered trading zone', async () => {

            let nonTradingZoneId = 99;

            await assertThrows(
                waterLicenceContract.issueLicence(licenseeAddress, 'aaaa', nonTradingZoneId, unixTime(startDate), unixTime(endDate), administrativePlan, {from: waterAuthorityAddress}),
                'Should error on invalid trading zone id'
            );

        });

    });

    describe('Adds water allocation to a water licence', () => {

        it('Successfully adds a water allocation to a water licence', async () => {

            await waterLicenceContract.issueLicence(licenseeAddress, reference, tradingZoneId, unixTime(startDate), unixTime(endDate), administrativePlan, {from: waterAuthorityAddress});

            let expectedLicenceId = 0;
            let volume = 1000;
            await waterLicenceContract.addAllocation(expectedLicenceId, volume, {from: waterAuthorityAddress});

            let actualAllocation = await waterLicenceContract.allocationById(expectedLicenceId, {from: owner});
            assert.equal(actualAllocation, volume, 'Allocation not recorded correctly');

        });

    });

    describe('Checks whether a water trader can trade', () => {

        it('Returns true if they have a valid water licence and within their allocation', async () => {

            //issue a licence
            await waterLicenceContract.issueLicence(licenseeAddress, reference, tradingZoneId, unixTime(startDate), unixTime(endDate), administrativePlan, {from: waterAuthorityAddress});

            // add an allocation
            let expectedLicenceId = 0;
            let volume = 1000;
            await waterLicenceContract.addAllocation(expectedLicenceId, volume, {from: waterAuthorityAddress});

            // they should be able to trade
            let canTrade = await waterLicenceContract.canTrade(expectedLicenceId, licenseeAddress, 500, {from: owner});
            assert.isTrue(canTrade, `Trader should be able to trade but can't`);

        });

        it('Returns false if the trader address does not match the licensee address', async () => {

            // issue licence and allocation
            let expectedLicenceId = 0;
            let allocationVolume = 1000;
            await scenarioIssueLicence({expectedLicenceId, allocationVolume});

            // a random should not be able to trade
            let randomAddress = accounts[5];
            let canTrade = await waterLicenceContract.canTrade(expectedLicenceId, randomAddress, 500, {from: owner});
            assert.isFalse(canTrade, `A random should not be able to trade on a licensees licence`);

        });

        it('Returns false if they do not have a valid water licence', async () => {

            let randomAddress = accounts[5];
            let expectedLicenceId = 0;
            let canTrade = await waterLicenceContract.canTrade(expectedLicenceId, randomAddress, 500, {from: owner});
            assert.isFalse(canTrade, `A random should not be able to trade without a licence`);

        });

        it('Returns false if they do not have a water allocation', async () => {

            // issue licence and allocation
            let expectedLicenceId = 0;
            let allocationVolume = 1000;
            await scenarioIssueLicence({expectedLicenceId, allocationVolume, allocate: false});

            // should not be able to trade without an allocation
            let canTrade = await waterLicenceContract.canTrade(expectedLicenceId, licenseeAddress, 500, {from: owner});
            assert.isFalse(canTrade, `Should not be able to trade water without an allocation`);

        });

        it('Returns false if they have exceeded their water allocation', async () => {

            // issue licence and allocation
            let expectedLicenceId = 0;
            let allocationVolume = 1000;
            await scenarioIssueLicence({expectedLicenceId, allocationVolume});

            // a random should not be able to trade
            let canTrade = await waterLicenceContract.canTrade(expectedLicenceId, licenseeAddress, 2000, {from: owner});
            assert.isFalse(canTrade, `Should not be able to trade more than their allocation`);

        });

    });

    async function scenarioIssueLicence({expectedLicenceId, allocationVolume, allocate = true}) {

        //issue a licence
        await waterLicenceContract.issueLicence(licenseeAddress, reference, tradingZoneId, unixTime(startDate), unixTime(endDate), administrativePlan, {from: waterAuthorityAddress});

        if(allocate) {

            // add an allocation
            await waterLicenceContract.addAllocation(expectedLicenceId, allocationVolume, {from: waterAuthorityAddress});

        }

    }

});