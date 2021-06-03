import React from "react"
import './App.css'
import {getWeb3} from "./getWeb3"
import map from "./artifacts/deployments/map.json"
import {getEthereum} from "./getEthereum"

class App extends React.Component {

    state = {
        //--- base
        web3: null,
        accounts: null,
        chainid: null,
        cytokenin: null,
        garden: null,
        ckDecimals: 0,
        //--- display
        yourCytokenin: 0,
        yourPlants: {},
        plantInfo: [],
        //--- input
        directionUp : true,
        aggOptions: [],
        aggregator: "",
        queryPlantID: 0,
        changePlantID: 0,
    }

    componentDidMount = async () => {

        // Get network provider and web3 instance.
        const web3 = await getWeb3()

        // Try and enable accounts (connect metamask)
        try {
            const ethereum = await getEthereum()
            ethereum.enable()
        } catch (e) {
            console.log(`Could not enable accounts. Interaction with contracts not available.
            Use a modern browser with a Web3 plugin to fix this issue.`)
            console.log(e)
        }

        // Use web3 to get the user's accounts
        const accounts = await web3.eth.getAccounts()

        // Get the current chain id
        const chainid = parseInt(await web3.eth.getChainId())

        this.setState({
            web3,
            accounts,
            chainid
        }, await this.loadInitialContracts)

    }

    loadInitialContracts = async () => {
        
        const { chainid } = this.state

        if (chainid <= 42) {
            // Wrong Network!
            return
        }

        const cytokenin = await this.loadContract("dev", "Cytokenin")
        const garden = await this.loadContract("dev", "CryptoGarden")
        const ckDecimals = await cytokenin.methods.decimals().call()
        const aggOptions = map["dev"]["MockV3Aggregator"]
        const aggregator = aggOptions[0]

        if (!cytokenin || !garden) {
            return
        }

        this.setState({ cytokenin, garden, ckDecimals, aggOptions, aggregator })
    
        await this.getCytokeninBalance()
        await this.getPlantList()
    }

    loadContract = async (chain, contractName) => {
        // Load a deployed contract instance into a web3 contract object
        const { web3 } = this.state

        // Get the address of the most recent deployment from the deployment map
        let address
        try {
            address = map[chain][contractName][0]
        } catch (e) {
            console.log(`Couldn't find any deployed contract "${contractName}" on the chain "${chain}".`)
            return undefined
        }

        // Load the artifact with the specified address
        let contractArtifact
        try {
            contractArtifact = await import(`./artifacts/deployments/${chain}/${address}.json`)
        } catch (e) {
            console.log(`Failed to load contract artifact "./artifacts/deployments/${chain}/${address}.json"`)
            return undefined
        }

        return new web3.eth.Contract(contractArtifact.abi, address)
    }

    getCytokeninBalance = async () => {
        const {accounts, cytokenin, ckDecimals} = this.state
        if (accounts.length === 0) {
            return
        }
        this.setState({ yourCytokenin: ((await cytokenin.methods.balanceOf(accounts[0]).call())/10**ckDecimals).toFixed(2) })
    }

    getPlantList = async () => {
        const { accounts, garden } = this.state
        if (accounts.length === 0) {
            return
        }
        const plantIDs = await garden.methods.getPlantsByOwner(accounts[0]).call()
        let yourPlants = {}
        for (let id of plantIDs)
        {
            yourPlants[id] = await garden.methods.showPlant(id).call()
        }
        this.setState({ yourPlants })
    }

    plantSeed = async (e) => {
        const { accounts, garden, directionUp, aggregator } = this.state
        e.preventDefault()
        garden.methods.seed(aggregator, directionUp).send({ from: accounts[0] })
            .on("receipt", async () => {
                this.getPlantList()
            })
            .on("error", async () => {
                console.log("error")
            })
    }

    plantInterface = (id) => {
        const { yourPlants } = this.state
        return <form className="plant" key={id} onSubmit={(e) => this.showCertainPlant(e)}>
            <div>
                {id}: {yourPlants[id].join(" | ")}
                <button type="submit" value={id} onClick={(e) => this.setState({ queryPlantID: e.target.value })}>check</button>
                <button value={id} onClick={(e) => this.changeDirection(e)}>turn</button>
                <button value={id} onClick={(e) => this.extractCytokenin(e)}>extract</button>
                <button value={id} onClick={(e) => this.recover(e)}>recover</button>
            </div>
        </form>
    }

    showCertainPlant = async (e) => {
        const { garden, queryPlantID } = this.state
        e.preventDefault()
        const pid = parseInt(queryPlantID)
        if (isNaN(pid)) {
            alert("invalid plant ID")
            return
        }
        if (!(await garden.methods.existPlant(pid).call())) {
            this.setState({ plantInfo: ["not exists"] })
            return
        }

        garden.methods.showPlant(pid).call().then((result) => {
            this.setState({ plantInfo: result })
        }).catch((err) => {
            console.log(err)
            this.setState({ plantInfo: ["not exists"] })
        })
    }

    changeDirection = async (e) => {
        const { accounts, garden } = this.state
        e.preventDefault()
        const pid = parseInt(e.target.value)
        garden.methods.turnAround(pid).send({ from: accounts[0] })
            .on("receipt", async () => {
                this.getPlantList()
            })
            .on("error", async () => {
                console.log("error")
            })
    }

    extractCytokenin = async (e) => {
        const { accounts, garden } = this.state
        e.preventDefault()
        const pid = parseInt(e.target.value)
        garden.methods.extractCytokenin(pid).send({ from:accounts[0] })
            .on("receipt", async () => {
                this.getPlantList()
                this.getCytokeninBalance()
            })
            .on("error", async () => {
                console.log("error")
            })
    }

    recover = async (e) => {
        const { accounts, garden } = this.state
        e.preventDefault()
        const pid = parseInt(e.target.value)
        garden.methods.recoverTurning(pid).send({ from: accounts[0] })
            .on("receipt", async () => {
                this.getPlantList()
                this.getCytokeninBalance()
            })
            .on("error", async () => {
                console.log("error")
            })
    }

    render() {
        const {
            web3, accounts, chainid,
            cytokenin, garden,
            yourCytokenin, yourPlants, plantInfo,
            aggOptions, aggregator, queryPlantID
        } = this.state

        if (!web3) {
            return <div>Loading Web3, accounts, and contracts...</div>
        }

        if (isNaN(chainid) || chainid <= 42) {
            return <div>Wrong Network! Switch to your local RPC "Localhost: 8545" in your Web3 provider (e.g. Metamask)</div>
        }

        if (!cytokenin || !garden) {
            return <div>Could not find a deployed contract. Check console for details.</div>
        }

        const isAccountsUnlocked = accounts ? accounts.length > 0 : false
        const plantList = Object.keys(yourPlants).map((id) => this.plantInterface(id))
        const aggSelection = aggOptions.map((opt) => 
            <option key={opt} value={opt}> {opt} </option>
        )

        return (<div className="App">
            {
                !isAccountsUnlocked ?
                    <p><strong>Connect with Metamask and refresh the page.</strong>
                    </p>
                    : null
            }

            <h1>Crypto Gardener</h1>
            <div> <h3>your cytokenin</h3>{yourCytokenin}</div>
            <div> <h3>your plants</h3>{plantList}</div>
            <br/>
            <form onSubmit={(e) => this.plantSeed(e)}>
                <div>
                    <h3>plant a seed</h3>
                    <select name="aggOptions" value={aggregator} onChange={(e) => this.setState({ aggregator: e.target.value })}>
                        {aggSelection}
                    </select>
                    <br />
                    <button type="submit" disabled={!isAccountsUnlocked} onClick={() => (this.setState({directionUp: true}))}>go up</button>
                    <button type="submit" disabled={!isAccountsUnlocked} onClick={() => (this.setState({directionUp: false}))}>go down</button>
                </div>
            </form>
            <br/>
            <form onSubmit={(e) => this.showCertainPlant(e)}>
                <div>
                    <h3>check a plant</h3>
                    <input
                        name="queryPlantID"
                        type="text"
                        value={queryPlantID}
                        onChange={(e) => this.setState({queryPlantID: e.target.value})}
                    />
                    <br/>
                    <button type="submit" disabled={!isAccountsUnlocked}>query</button>
                </div>
            <div> <br/>{plantInfo.join(" | ")}</div>
            </form>
        </div>)
    }
}

export default App
