const History = artifacts.require("HistoryTesting");

let AssembleStruct = require('./helpers/AssembleStruct');

const { subHours, subDays, subWeeks, subMonths, getTime } = require('date-fns');

const tradeStructDefinition = [
  {name: 'buyer', type: 'address'},
  {name: 'seller', type: 'address'},
  {name: 'averagePrice', type: 'uint256'},
  {name: 'quantity', type: 'uint256'},
  {name: 'timeStamp', type: 'uint256'},
];

contract("History", function(accounts) {

  const OWNER = accounts[0];
  const ALICE = accounts[1];
  const BOB = accounts[2];

  describe("Trade History", async () => {

    let contractInstance;
    
    beforeEach(async () => contractInstance = await History.new());

    const currentTime = Date.now();
    const currentTimeSeconds = Date.now();
    const oneHourAgo = getTime(subHours(currentTime, 1));
    const yesterday = getTime(subDays(currentTime, 1));
    const oneWeekAgo = getTime(subWeeks(currentTime, 1));
    const oneMonthAgo = getTime(subMonths(currentTime, 1));
    const historyPrice = 500;
    const historyQuantity = 500;

    it("Should return a list of history", async () => {
      await contractInstance.manualHistoryAdd(BOB, ALICE, historyPrice, historyQuantity, yesterday);
      await contractInstance.manualHistoryAdd(BOB, ALICE, historyPrice, historyQuantity, oneHourAgo);
      await contractInstance.manualHistoryAdd(BOB, ALICE, historyPrice, historyQuantity, currentTime);

      let history = await contractInstance.getHistory(5);
      let fixedHistory = AssembleStruct.assemble(tradeStructDefinition, Object.values(history));

      assert.equal(fixedHistory.length, 3, "Should be returning three history items");
    });

    it("Should sort history", async () => {
      await contractInstance.manualHistoryAdd(BOB, ALICE, 1, 3, yesterday);
      await contractInstance.manualHistoryAdd(BOB, ALICE, 2, 2, oneHourAgo);
      await contractInstance.manualHistoryAdd(BOB, ALICE, 3, 5, oneMonthAgo);
      await contractInstance.manualHistoryAdd(BOB, ALICE, 4, 1, currentTime);
      await contractInstance.manualHistoryAdd(BOB, ALICE, 5, 4, oneWeekAgo);

      let history = await contractInstance.getHistory(5);
      let fixedHistory = AssembleStruct.assemble(tradeStructDefinition, Object.values(history));

      fixedHistory.forEach(({quantity}, index) => assert.equal(quantity, index + 1, "Ordering is not correct"));
    });

    it("Should allow partial returning of history", async () => {
      await contractInstance.manualHistoryAdd(BOB, ALICE, 1, 3, yesterday);
      await contractInstance.manualHistoryAdd(BOB, ALICE, 2, 2, oneHourAgo);
      await contractInstance.manualHistoryAdd(BOB, ALICE, 3, 5, oneMonthAgo);
      await contractInstance.manualHistoryAdd(BOB, ALICE, 4, 1, currentTime);
      await contractInstance.manualHistoryAdd(BOB, ALICE, 5, 4, oneWeekAgo);

      const numberOfHistory = 3;

      let history = await contractInstance.getHistory(numberOfHistory);
      let fixedHistory = AssembleStruct.assemble(tradeStructDefinition, Object.values(history));

      assert.equal(fixedHistory.length, numberOfHistory, "An incorrect number of history items is being returned");
      assert.equal(fixedHistory[0].timeStamp, currentTimeSeconds, "Incorrect sorting is returning the wrong time");
      assert.equal(fixedHistory[1].timeStamp, oneHourAgo, "Incorrect sorting is returning the wrong time");
      assert.equal(fixedHistory[2].timeStamp, yesterday, "Incorrect sorting is returning the wrong time");
    });

    it("Should handle requesting a larger number of history items than its length", async () => {
      await contractInstance.manualHistoryAdd(BOB, ALICE, historyPrice, historyQuantity, currentTime);
      await contractInstance.manualHistoryAdd(BOB, ALICE, historyPrice, historyQuantity, currentTime);
      await contractInstance.manualHistoryAdd(BOB, ALICE, historyPrice, historyQuantity, currentTime);

      let history = await contractInstance.getHistory(5);
      let fixedHistory = AssembleStruct.assemble(tradeStructDefinition, Object.values(history));

      assert.equal(fixedHistory.length, 3, "An incorrect number of history items is being returned");
    });

    it("Properly handles an empty history", async () => {
      let history = await contractInstance.getHistory(5);
      let fixedHistory = AssembleStruct.assemble(tradeStructDefinition, Object.values(history));

      assert.equal(fixedHistory.length, 0, "An incorrect number of history items is being returned");
    });

    describe("History statistics and aggregates", () => {

      it("Should return the average price within a period", async () => {
        await contractInstance.manualHistoryAdd(BOB, ALICE, 100, 100, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 200, 100, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 100, oneHourAgo);

        const average = await contractInstance.averageValueTradedInPeriod(yesterday, currentTimeSeconds);
        assert.equal(Number(average), 200, "Average of these transactions should be $200");
     });

      it("Should not include in the average price any history outside the period", async () => {
        await contractInstance.manualHistoryAdd(BOB, ALICE, 100, 100, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 200, 100, yesterday);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 100, oneMonthAgo);

        const average = await contractInstance.averageValueTradedInPeriod(oneWeekAgo, currentTimeSeconds);
        assert.equal(Number(average), 150, "Average of these transactions should be $150");
      });

      it("Should not create any division errors on recursive numbers", async () => {
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 100, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 100, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 400, 100, oneHourAgo);

        const average = await contractInstance.averageValueTradedInPeriod(yesterday, currentTimeSeconds);

        assert.equal(Number(average), 333, "Average of these transactions should be $333");
      });

      it("Should return the total value traded within a period", async () => {
        await contractInstance.manualHistoryAdd(BOB, ALICE, 100, 100, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 200, 100, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 100, oneHourAgo);

        const total = await contractInstance.totalValueTradedInPeriod(yesterday, currentTimeSeconds);
        assert.equal(Number(total), 600, "Total of these transactions should be $600");
      });

      it("Should not include in the total value any history outside the period", async () => {
        await contractInstance.manualHistoryAdd(BOB, ALICE, 100, 100, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 200, 100, yesterday);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 100, oneMonthAgo);

        const total = await contractInstance.totalValueTradedInPeriod(oneWeekAgo, currentTimeSeconds);
        assert.equal(Number(total), 300, "Total of these transactions should be $300");
      });

      it("Should return the total volume of water traded within a period", async () => {
        await contractInstance.manualHistoryAdd(BOB, ALICE, 100, 200, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 200, 400, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 600, oneHourAgo);

        const total = await contractInstance.totalVolumeTradedInPeriod(yesterday, currentTimeSeconds);
        assert.equal(Number(total), 1200, "Total volume should be 1200 ML");
      });

      it("Should not include in the total volume any history outside the period", async () => {
        await contractInstance.manualHistoryAdd(BOB, ALICE, 100, 200, oneHourAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 200, 400, yesterday);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 600, oneMonthAgo);

        const total = await contractInstance.totalVolumeTradedInPeriod(oneWeekAgo, currentTimeSeconds);
        assert.equal(Number(total), 600, "Total of these transactions should be 600 ML");
      });

      it("averageValueTradedInPeriod should not error if there is no history", async () => {
        const average = await contractInstance.averageValueTradedInPeriod(yesterday, currentTimeSeconds);
        assert.equal(Number(average), 0, "Average trade should be zero");
      });

      it("averageValueTradedInPeriod should not error if there is no matching history", async () => {
        await contractInstance.manualHistoryAdd(BOB, ALICE, 100, 200, oneWeekAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 200, 400, oneWeekAgo);
        await contractInstance.manualHistoryAdd(BOB, ALICE, 300, 600, oneMonthAgo);

        const average = await contractInstance.averageValueTradedInPeriod(yesterday, currentTimeSeconds);
        assert.equal(Number(average), 0, "Average trade should be zero");
      });
    });
  });
});