const { ethers, waffle, network } = require("hardhat");

var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
var expect = chai.expect;

describe("Lottery", function () {
  const oneEther = ethers.utils.parseEther("1.0");
  const provider = waffle.provider;

  describe("test constructor", function () {
    it("Correct usage", async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      const lottery = Lottery.deploy(1, 0);
      await lottery;
    })
  });

  describe("test scheduleNextDraw", function () {
    let lottery;

    beforeEach(async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      lottery = await Lottery.deploy(1, 0);
      // This change the contract state to 'Finished'.
      await lottery.drawNumber();
    });

    it("State should be 'Finished(2)'", async function () {
      let tx;
      expect(await lottery.getState()).to.equal(2);
      tx = lottery.scheduleNextDraw(1, 0);
      await tx;
      // State will change to 'Opened(0)'.
      expect(await lottery.getState()).to.equal(0);
      tx = lottery.scheduleNextDraw(1, 0);
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Invalid state for the action");
    });

    it("Caller should be owner", async function () {
      let tx
      let owner;
      let addr1;
      [owner, addr1] = await ethers.getSigners();
      tx = lottery.connect(addr1).scheduleNextDraw(1, 0);
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'");
    });

    it("Entry fee must be positive integer", async function () {
      let tx;
      tx = lottery.scheduleNextDraw(-1, 0);
      await expect(tx).eventually.to.rejectedWith(Error);

      tx = lottery.scheduleNextDraw(0, 0);
      await expect(tx).eventually.to.rejectedWith(Error);

      tx = lottery.scheduleNextDraw(1.5, 0);
      await expect(tx).eventually.to.rejectedWith(Error);
    })
  });

  describe("test submitNumber", function () {
    let lottery;

    beforeEach(async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      lottery = await Lottery.deploy(1, 0);
    });

    it("Minimum entry fee required", async function () {
      let tx;
      tx = lottery.submitNumber(1);
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Minimum entry fee required'");

      tx = lottery.submitNumber(1, {
        value: oneEther
      });
      await tx;
    });

    it("State should be 'Finished(2)' and changed to 'Opened(0)'", async function () {
      let tx;
      expect(await lottery.getState()).to.equal(0);
      tx = lottery.submitNumber(1, {
        value: oneEther
      });
      await tx;

      await lottery.drawNumber();
      expect(await lottery.getState()).to.equal(2);
      tx = lottery.submitNumber(1, {
        value: oneEther
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Invalid state for the action");
    });

    it("Number should be in range 1-49", async function () {
      let tx;
      tx = lottery.submitNumber(0, {
        value: oneEther
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Number too small'");

      tx = lottery.submitNumber(50, {
        value: oneEther
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Number too large'");
    });

    it("Can't submit same number twice", async function () {
      let tx;
      tx = lottery.submitNumber(1, {
        value: oneEther
      });
      await tx;

      tx = lottery.submitNumber(2, {
        value: oneEther
      });
      await tx;

      tx = lottery.submitNumber(1, {
        value: oneEther
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Number already submitted'");
    });
  });

  describe("test drawNumber", function () {
    let lottery;
    const oneEther = ethers.utils.parseEther("1.0");

    beforeEach(async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      lottery = await Lottery.deploy(1, 0);
    });

    it("State should be 'Opened(0)' and changed to 'Finished(2)'", async function () {
      let tx;

      expect(await lottery.getState()).to.equal(0);

      tx = lottery.drawNumber();
      await tx;
      expect(await lottery.getState()).to.equal(2);

      tx = lottery.drawNumber();
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Invalid state for the action");
    });

    it("Block timestamp must be greater than draw time", async function () {
      let secondsSinceEpoch = Math.round(Date.now() / 1000);
      let Lottery2 = await ethers.getContractFactory("Lottery");
      let lottery2 = await Lottery2.deploy(1, secondsSinceEpoch + 1000);

      let tx;
      tx = lottery2.drawNumber();
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Too early to draw'");
    });

    it("Winner get paid with the prize", async function () {
      let owner;
      let addr1;
      [owner, addr1] = await ethers.getSigners();


      for (let i = 1; i <= 49; i++) {
        await lottery.connect(addr1).submitNumber(i, {
          value: oneEther
        });
      }

      let addr1Balance = await provider.getBalance(addr1.address);
      let prize = await provider.getBalance(lottery.address)
      expect(prize.eq(ethers.BigNumber.from("49000000000000000000"))).to.be.true;
      await lottery.drawNumber();

      let addr1NewBalance = await provider.getBalance(addr1.address);
      let contractBalance = await provider.getBalance(lottery.address);

      expect(addr1Balance.add(prize).eq(addr1NewBalance)).to.be.true;
      expect(contractBalance.eq(ethers.BigNumber.from("0"))).to.be.true;
    });
  });
});
