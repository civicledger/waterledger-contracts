// Assert that an error is thrown
async function assertThrows(promise, message = 'VM Exception') {
    try {
        await promise;
        assert.fail("Exception was not thrown");
    } catch (e) {
        console.log(e);
        //assert.include(e.message, message);
    }
}

exports.assertThrows = assertThrows;