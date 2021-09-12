import { initEnhancer, powerLevels, faunaNames } from "../scripts/param";

module.exports = async ({
    getNamedAccounts,
    deployments,
    getChainId,
    getUnnamedAccounts,
  }) => {
    const chainId = await getChainId();
    const { deploy, get } = deployments;
    const { deployer } = await getNamedAccounts();

    //--- get ENS registry address
    const ensAddr = (chainId === 1337) ?
        await get("MockEnsRegistry"): "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

    //--- deploy FaunaArmy
    const faunaArmy = await deploy("FaunaArmy", {
        from: deployer,
        args: [ensAddr, initEnhancer, powerLevels, faunaNames]
    });
    console.log("FaunaArmy deployed to:", faunaArmy.address);
};
  