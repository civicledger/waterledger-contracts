var QuickSort = artifacts.require("QuickSort");

contract("QuickSort", function (accounts) {
  var instance;

  beforeEach(async function () {
    instance = await QuickSort.new();
  });

  xit("should sort array of 1000 ints", async function () {
    //1000 random ints
    let data = [
      335,
      838,
      177,
      709,
      608,
      965,
      924,
      25,
      152,
      73,
      504,
      815,
      4,
      310,
      996,
      584,
      953,
      850,
      249,
      582,
      425,
      116,
      488,
      668,
      9,
      998,
      756,
      469,
      693,
      162,
      824,
      479,
      555,
      876,
      958,
      57,
      823,
      806,
      287,
      309,
      22,
      829,
      451,
      866,
      207,
      403,
      799,
      44,
      157,
      520,
      573,
      45,
      931,
      199,
      329,
      855,
      96,
      599,
      754,
      833,
      79,
      461,
      978,
      679,
      342,
      283,
      188,
      373,
      610,
      318,
      63,
      256,
      314,
      712,
      410,
      744,
      354,
      432,
      98,
      870,
      783,
      702,
      132,
      481,
      20,
      512,
      726,
      781,
      118,
      150,
      788,
      997,
      735,
      244,
      370,
      16,
      17,
      502,
      685,
      166,
    ];

    var actual = await instance.sort(data);
    assert.equal(actual.length, 100, "Should be 100");
  });

  xit("should sort array of ints", async function () {
    let data = [2, 4, 1, 5, 3, 6];

    var actual = await instance.sort(data);

    assert.equal(actual[0], 1, "Should be 1");
    assert.equal(actual[1], 2, "Should be 2");
    assert.equal(actual[2], 3, "Should be 3");
    assert.equal(actual[3], 4, "Should be 4");
    assert.equal(actual[4], 5, "Should be 5");
    assert.equal(actual[5], 6, "Should be 6");
  });

  xit("should reverse sort array of ints", async function () {
    let data = [2, 4, 1, 5, 3, 6];

    var actual = await instance.reverseSort(data);

    assert.equal(actual[0], 6, "Should be 6");
    assert.equal(actual[1], 5, "Should be 5");
    assert.equal(actual[2], 4, "Should be 4");
    assert.equal(actual[3], 3, "Should be 3");
    assert.equal(actual[4], 2, "Should be 2");
    assert.equal(actual[5], 1, "Should be 1");
  });

  xit("should sort array of ints by index", async function () {
    let indexes = [0, 1, 2, 3, 4, 5];
    let data = [2, 4, 1, 5, 3, 6];

    var actual = await instance.sortWithIndex(data, indexes);

    assert.equal(actual.length, 6, "Array length should be six");

    assert.equal(actual[0], 2, "Should be index 2");
    assert.equal(actual[1], 0, "Should be index 0");
    assert.equal(actual[2], 4, "Should be index 4");
    assert.equal(actual[3], 1, "Should be index 1");
    assert.equal(actual[4], 3, "Should be index 3");
    assert.equal(actual[5], 5, "Should be index 5");
  });

  xit("should reverse sort array of ints by index", async function () {
    let indexes = [0, 1, 2, 3, 4, 5];
    let data = [2, 4, 1, 5, 3, 6];

    var actual = await instance.reverseSortWithIndex(data, indexes);

    assert.equal(actual.length, 6, "Array length should be six");

    assert.equal(actual[5], 2, "Should be index 2");
    assert.equal(actual[4], 0, "Should be index 0");
    assert.equal(actual[3], 4, "Should be index 4");
    assert.equal(actual[2], 1, "Should be index 1");
    assert.equal(actual[1], 3, "Should be index 3");
    assert.equal(actual[0], 5, "Should be index 5");
  });
});
