var Stats = artifacts.require("Stats");

contract('Stats', function(accounts) {

  var statInstance;
  const defaultVolume = 22403;
  const inTransit = 45;
  const average = 17212;
  const priceMin = 19243;
  const priceMax = 13243;

  const ALICE = accounts[1];

  beforeEach(async function() {
    statInstance = await Stats.new(defaultVolume, inTransit, average, priceMin, priceMax);
  });

  it("should allow the volume to be set", async function() {
    await statInstance.setVolumeAvailable(defaultVolume);

    let volumeObj = await statInstance._volumeAvailable();
    assert.equal(Number(volumeObj), defaultVolume, 'Volume Available is not set correctly');
  });

  it("should reject setting the volume is zero or less", async function() {
    try{
        await statInstance.setVolumeAvailable(0);
    } catch(error) {
        var exceptionThrown = true;
        var reason = error.reason;
    }

    assert.isTrue(exceptionThrown, 'Exception was not thrown');
    assert.equal(reason, "Volume must be greater than zero", 'Wrong revert reason given');
  });

  it("should reject setting the volume if user is incorrect", async function() {
    try{
        await statInstance.setVolumeAvailable(defaultVolume, {from: accounts[1]});
    } catch(error) {
        var reason = error.reason;
        var exceptionThrown = true;
    }

    assert.isTrue(exceptionThrown, 'Exception was not thrown');
    assert.equal(reason, "Only writers can set volume", 'Wrong revert reason');
  });

  it("should allow a user to set all of the stats", async () => {
    await statInstance.setStats(1, 2, 3, 4, 5);
    let minBid = await statInstance._yesterdayMinBid();
    let maxBid = await statInstance._yesterdayMaxBid();
    assert.equal(Number(minBid), 4, 'Setting stats is not working correctly');
    assert.equal(Number(maxBid), 5, 'Setting stats is not working correctly');
  });

  it("should allow a user to get all of the stats in one request", async () => {
    let { volume, inTransit, avg, min, max } = await statInstance.getAllStats();
    
    assert.equal(Number(volume), defaultVolume, 'Setting volume is not working correctly');
    assert.equal(Number(inTransit), inTransit, 'Setting inTransit is not working correctly');
    assert.equal(Number(avg), average, 'Setting average is not working correctly');
    assert.equal(Number(min), priceMin, 'Setting min is not working correctly');
    assert.equal(Number(max), priceMax, 'Setting max is not working correctly');
  });

  it("should reject setting the volume if not owner", async function() {
    try {
      await statInstance.setVolumeAvailable(defaultVolume, {from: ALICE});
    } catch(error) {
      assert(error);
      assert.equal(error.reason, "Only writers can set volume", "Incorrect revert reason");
    }
  });
});