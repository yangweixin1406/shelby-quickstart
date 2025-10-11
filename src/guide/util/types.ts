export interface ShelbyConfig {
	accounts: {
		[name: string]: {
			address: string
			private_key: string
		}
	}
	contexts: {
		[name: string]: {
			aptos_network: NetworkConfig
			shelby_rpc_endpoint: string
		}
	}
	default_account?: string
	default_context?: string
}
export interface EnvVariables {
	account_name: string
	address: string
	private_key: string
	context_name: string
	network: NetworkConfig
	api_key: string
}
export interface NetworkConfig {
	name: string
	fullnode: string
	faucet: string
	indexer: string
	pepper: string
	prover: string
}
