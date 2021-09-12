const hre = require("hardhat");
const {ethers, BigNumber} = require("ethers");
const { expect, assert } = require("chai");


const zeroAddress = ethers.constants.AddressZero;
const initEnhancer = 7777777777777;
const powerLevels = [0, 1100, 1300, 1500, 2000];
const floraPrefix = "https://ipfs.io/ipfs/bafybeieh3wt7szwrdujfver5nfwbqfh7z6pcodk2h5k46m24oqmizolame/";
const floraNames = ['flora_1.json', 'flora_2.json', 'flora_3.json', 'flora_4.json', 'flora_5.json'];
const faunaPrefix = "https://ipfs.io/ipfs/bafybeigd7f3maglyvcyvxonmu4copfosxqocg5dpyetw7ozg22m44j27le/";
const faunaNames = ['fauna_1.json', 'fauna_2.json', 'fauna_3.json', 'fauna_4.json', 'fauna_5.json'];


describe("Deploy all contract", async function () {

  let bnb_hash;
  let flora_army;
  let owner, addr1, addr2;
  let minions;


  beforeEach(async function () {
    
    //--- get chain ID
    const chainId = await hre.getChainId();

    //--- setup local ENS, resolver and aggregator when in local network
    const setupEnsRegistry = async () => {
      const ENS = await hre.ethers.getContractFactory("MockEnsRegistry");
      const ens = await ENS.deploy();
      await ens.deployed();
      console.log("ENS deployed to:", ens.address);

      const Resolver = await hre.ethers.getContractFactory("MockPublicResolver");
      const resolver = await Resolver.deploy();
      await resolver.deployed();
      console.log("Resolver deployed to:", resolver.address);

      const Aggregator = await hre.ethers.getContractFactory("MockV3Aggregator");
      const mockPairs = ['eth-usd', 'btc-usd', 'bnb-usd', 'link-usd'];
      const mockPrices = [3500, 50000, 400, 30];

      mockPairs.map(async (pair, idx) => {
        const namehash = ethers.utils.namehash(pair + ".data.eth");
        console.log(idx);
        console.log(pair, namehash);
        const mockAgg = await Aggregator.deploy(1, mockPrices[idx] * 8);
        await mockAgg.deployed();
        console.log(pair, "Aggregator deployed to:", mockAgg.address);
        ens.setResolver(namehash, resolver.address);
        resolver.setAddr(namehash, mockAgg.address);
      })
      return ens.address;
    }

    //--- get ENS registry address
    const ensRegistryAddr = (chainId === '1337') ?
      await setupEnsRegistry() : "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

    //--- deploy FloraArmy
    const FloraArmy = await hre.ethers.getContractFactory("FloraArmy");
    const floraArmy = await FloraArmy.deploy(
      ensRegistryAddr, initEnhancer, powerLevels, floraNames
    );
    await floraArmy.deployed();
    console.log("FloraArmy deployed to:", floraArmy.address);

    //--- deploy FaunaArmy
    const FaunaArmy = await hre.ethers.getContractFactory("FaunaArmy");
    const faunaArmy = await FaunaArmy.deploy(
      ensRegistryAddr, initEnhancer, powerLevels, faunaNames
    );
    await faunaArmy.deployed();
    console.log("FaunaArmy deployed to:", faunaArmy.address);

    //--- setup FloraRank prefix
    const FloraRank = await hre.ethers.getContractFactory("ArmyRank");
    const floraRank = FloraRank.attach(await floraArmy.rankContract())
    floraRank.updateBranchPrefix(zeroAddress, floraPrefix);
    console.log("FloraRank prefix:", await floraRank.branchPrefix(zeroAddress));

    //--- setup FaunaRank prefix
    const FaunaRank = await hre.ethers.getContractFactory("ArmyRank");
    const faunaRank = FaunaRank.attach(await faunaArmy.rankContract())
    faunaRank.updateBranchPrefix(zeroAddress, faunaPrefix);
    console.log("FaunaRank prefix:", await faunaRank.branchPrefix(zeroAddress));

    //--- deploy battlefield
    const Battlefield = await hre.ethers.getContractFactory("Battlefield");
    const battlefield = await Battlefield.deploy(floraArmy.address, faunaArmy.address);
    await battlefield.deployed();
    console.log("Battlefield deployed to:", battlefield.address);

    // for test
    [owner, addr1, addr2] = await hre.ethers.getSigners();
    const pair = 'bnb-usd';
    bnb_hash = ethers.utils.namehash(pair + ".data.eth");
    flora_army = floraArmy;
    
    // recruit 3 minions
    await flora_army.recruit(bnb_hash);
    await flora_army.recruit(bnb_hash);
    await flora_army.recruit(bnb_hash);

    minions = await flora_army.getMinionIDs(owner.address);

  });

  it("Army base contract", async function () {

    
    assert(minions.length === 3, "mimionsID length");

    // transfer function
    await flora_army.transferFrom(owner.address, addr1.address, minions[0]);
    assert( await flora_army.ownerOf(minions[0]) === addr1.address, 'transfer to addr1');
    assert( await flora_army.ownerOf(minions[0]) != owner.address, 'transfer success');
    await expect(
       flora_army.transferFrom(owner.address, addr1.address, minions[0])
    ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");

    //get minion info
    const infos = await flora_army.getTeamInfo(minions);
    infos.map(async (minion, idx) => {
      await expect(
        minion.power
      ).to.equal(await BigNumber.from(1000) );

      await expect(
        minion.armed
      ).to.equal(false );

    });

    // liberate
    await expect(
      flora_army.liberate(minions[0])
    ).to.be.revertedWith( "ARMY: commander can't command the minion" );

    await expect(
      flora_army.liberate(minions[1])
    ).to.be.revertedWith( "ARMY: can only liberate armed minion" );



  });

  it("floraArmy contract", async function () {

    // train before liberate
    await flora_army.arm(minions[0]);
    const info = await flora_army.getMinionInfo(minions[0]);
    assert( await info[1] === true, 'armed = true after arm');

    
    await flora_army.liberate(minions[0]);
    await expect(
      flora_army.ownerOf(minions[0])
    ).to.be.revertedWith("ERC721: owner query for nonexistent token");

    const profile = await flora_army.getMinionProfile(minions[1]);
    console.log(profile);
    

  });

});